import uuid
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions

from apps.accounts.models import User, Connection
from .models import Notification, NotificationPreference
from .serializers import NotificationSerializer


def get_actor_recipient(request):
    if request.user and request.user.is_authenticated:
        return request.user
    dev_header = request.headers.get('X-DevSync-User')
    if dev_header:
        user = User.objects.filter(username__iexact=dev_header.strip()).first()
        if user:
            return user
    return User.objects.filter(username='naveen3438').first()


def find_notification(notif_id, recipient=None):
    qs = Notification.objects.all()
    if recipient:
        qs = qs.filter(recipient=recipient)

    try:
        val = uuid.UUID(str(notif_id))
        return qs.filter(id=val).first()
    except (ValueError, AttributeError):
        pass

    return qs.filter(id=notif_id).first()


class NotificationsListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        user = get_actor_recipient(request)
        if not user:
            notifs = Notification.objects.all()
        else:
            notifs = Notification.objects.filter(recipient=user)

        serializer = NotificationSerializer(notifs, many=True)
        items = serializer.data
        unread_count = sum(1 for n in items if n.get('unread'))

        return Response({
            'notifications': items,
            'summary': {
                'total': len(items),
                'unread': unread_count
            }
        })


class NotificationConnectionActionView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        notif_id = request.data.get('notification_id')
        action = request.data.get('action', 'accept').lower()

        notif = find_notification(notif_id)
        if notif:
            notif.unread = False
            notif.save(update_fields=['unread'])

            # Update connection status if matching connection exists
            actor_name = notif.actor_username
            requester = User.objects.filter(username__iexact=actor_name).first()
            if requester:
                conn = Connection.objects.filter(
                    requester=requester,
                    recipient=notif.recipient
                ).first()
                if conn:
                    conn.status = 'accepted' if action == 'accept' else 'declined'
                    conn.save(update_fields=['status'])

        return Response({
            "success": True,
            "action": action,
            "message": f"Connection request {action}ed successfully."
        }, status=status.HTTP_200_OK)


class NotificationMarkReadView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        user = get_actor_recipient(request)
        mark_all = request.data.get('all', False)
        target_id = request.data.get('id')

        qs = Notification.objects.filter(recipient=user) if user else Notification.objects.all()

        if mark_all:
            qs.update(unread=False)
        elif target_id:
            notif = find_notification(target_id, user)
            if notif:
                notif.unread = False
                notif.save(update_fields=['unread'])

        total = qs.count()
        unread = qs.filter(unread=True).count()

        return Response({
            "success": True,
            "summary": {
                "total": total,
                "unread": unread
            }
        }, status=status.HTTP_200_OK)


class NotificationMarkUnreadView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        user = get_actor_recipient(request)
        target_id = request.data.get('id')

        if target_id:
            notif = find_notification(target_id, user)
            if notif:
                notif.unread = True
                notif.save(update_fields=['unread'])

        qs = Notification.objects.filter(recipient=user) if user else Notification.objects.all()
        total = qs.count()
        unread = qs.filter(unread=True).count()

        return Response({
            "success": True,
            "summary": {
                "total": total,
                "unread": unread
            }
        }, status=status.HTTP_200_OK)


class NotificationDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def delete(self, request, notif_id):
        user = get_actor_recipient(request)
        notif = find_notification(notif_id, user)
        if notif:
            notif.delete()
            return Response({"success": True, "deleted": notif_id}, status=status.HTTP_200_OK)

        return Response({"error": "Notification not found"}, status=status.HTTP_404_NOT_FOUND)
