import uuid

from django.db.models import Q
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User

from .models import Conversation, Message, Participant, Reaction, StatusUpdate
from .serializers import (
    ConversationSerializer,
    MessageSerializer,
    StatusUpdateSerializer,
)


def find_conversation(conv_id):
    qs = Conversation.objects.all()
    conv = qs.filter(custom_id=conv_id).first()
    if conv:
        return conv
    try:
        val = uuid.UUID(str(conv_id))
        return qs.filter(id=val).first()
    except (ValueError, AttributeError):
        pass
    return qs.filter(slug=conv_id).first()


def find_message(msg_id):
    qs = Message.objects.all()
    msg = qs.filter(custom_id=msg_id).first()
    if msg:
        return msg
    try:
        val = uuid.UUID(str(msg_id))
        return qs.filter(id=val).first()
    except (ValueError, AttributeError):
        pass
    return None


class ChatConversationsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        if request.user and request.user.is_authenticated:
            convs = Conversation.objects.filter(
                participants__user=request.user
            ).distinct()
            if not convs.exists():
                convs = Conversation.objects.all()
        else:
            convs = Conversation.objects.all()

        return Response(ConversationSerializer(convs, many=True).data)


class ConversationMessagesView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, conv_id):
        conv = find_conversation(conv_id)
        if not conv:
            return Response([], status=status.HTTP_200_OK)

        msgs = conv.messages.all()
        return Response(MessageSerializer(msgs, many=True).data)

    def post(self, request, conv_id):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {"error": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        conv = find_conversation(conv_id)
        if not conv:
            conv = Conversation.objects.create(
                custom_id=conv_id, title=f"Chat {conv_id}"
            )

        user = request.user
        text = request.data.get("text", "").strip()
        if not text:
            return Response(
                {"error": "Message text is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        msg = Message.objects.create(
            conversation=conv,
            sender=user,
            text=text,
            custom_id=f"msg-{uuid.uuid4().hex[:8]}",
        )
        return Response(MessageSerializer(msg).data, status=status.HTTP_201_CREATED)


class MessageReactionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, msg_id):
        msg = find_message(msg_id)
        if not msg:
            conv = Conversation.objects.first()
            if not conv:
                conv = Conversation.objects.create(title="General")
            msg = Message.objects.create(
                conversation=conv,
                sender=request.user,
                text="placeholder",
                custom_id=msg_id,
            )

        user = request.user
        emoji = request.data.get("emoji", "🚀")

        reaction, _ = Reaction.objects.update_or_create(
            message=msg, user=user, defaults={"emoji": emoji}
        )
        return Response(
            {"success": True, "emoji": emoji, "message_id": msg_id},
            status=status.HTTP_200_OK,
        )


class ChatStatusesView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        now = timezone.now()
        statuses = StatusUpdate.objects.filter(expires_at__gt=now)
        return Response(StatusUpdateSerializer(statuses, many=True).data)

    def post(self, request):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {"error": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        user = request.user
        text = request.data.get("text", "").strip()
        if not text:
            return Response(
                {"error": "Status text is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        audience = request.data.get("audience", "everyone")
        st = StatusUpdate.create_status(
            user=user, text=text, audience=audience, hours=24
        )
        return Response(StatusUpdateSerializer(st).data, status=status.HTTP_201_CREATED)
