from rest_framework import serializers

from .models import Conversation, Message, Participant, Reaction, StatusUpdate


class ReactionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = Reaction
        fields = ["id", "emoji", "username", "created_at"]


class MessageSerializer(serializers.ModelSerializer):
    id = serializers.SerializerMethodField()
    sender = serializers.CharField(source="sender.username", read_only=True)
    senderName = serializers.CharField(source="sender.full_name", read_only=True)
    senderAvatar = serializers.SerializerMethodField()
    reactions = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            "id",
            "text",
            "sender",
            "senderName",
            "senderAvatar",
            "reactions",
            "created_at",
        ]

    def get_id(self, obj):
        return obj.custom_id or str(obj.id)

    def get_senderAvatar(self, obj):
        profile = getattr(obj.sender, "profile", None)
        if profile and profile.avatar:
            return profile.avatar.url
        return "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"

    def get_reactions(self, obj):
        res = {}
        for r in obj.reactions.all():
            res[r.emoji] = res.get(r.emoji, 0) + 1
        return res


class ConversationSerializer(serializers.ModelSerializer):
    id = serializers.SerializerMethodField()
    participantUsernames = serializers.SerializerMethodField()
    lastMessage = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            "id",
            "title",
            "conv_type",
            "participantUsernames",
            "lastMessage",
            "updated_at",
        ]

    def get_id(self, obj):
        return obj.custom_id or str(obj.id)

    def get_participantUsernames(self, obj):
        return list(obj.participants.values_list("user__username", flat=True))

    def get_lastMessage(self, obj):
        last = obj.messages.last()
        return last.text if last else ""


class StatusUpdateSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    authorName = serializers.CharField(source="user.full_name", read_only=True)
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = StatusUpdate
        fields = [
            "id",
            "text",
            "audience",
            "username",
            "authorName",
            "avatar",
            "created_at",
            "expires_at",
        ]

    def get_avatar(self, obj):
        profile = getattr(obj.user, "profile", None)
        if profile and profile.avatar:
            return profile.avatar.url
        return "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"
