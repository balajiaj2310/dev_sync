from rest_framework import serializers

from .models import Notification, NotificationPreference


class NotificationSerializer(serializers.ModelSerializer):
    time = serializers.SerializerMethodField()
    actorName = serializers.SerializerMethodField()
    actorAvatar = serializers.CharField(source="actor_avatar")

    class Meta:
        model = Notification
        fields = [
            "id",
            "category",
            "title",
            "description",
            "unread",
            "actor_username",
            "actorName",
            "actorAvatar",
            "payload",
            "time",
            "created_at",
        ]

    def get_time(self, obj):
        # Format human friendly time string
        return "Just now"

    def get_actorName(self, obj):
        return obj.actor_username or "DevSync Member"


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = ["id", "channel", "category", "enabled"]
