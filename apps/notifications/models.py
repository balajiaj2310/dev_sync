import uuid

from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedUUIDModel


class Notification(TimeStampedUUIDModel):
    CATEGORY_CHOICES = [
        ("repository", "Repository"),
        ("pull_request", "Pull Request"),
        ("issue", "Issue"),
        ("mention", "Mention"),
        ("team", "Team"),
        ("connection", "Connection"),
    ]

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, db_index=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    unread = models.BooleanField(default=True, db_index=True)
    actor_username = models.CharField(max_length=150, blank=True, default="")
    actor_avatar = models.URLField(blank=True, default="")
    payload = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.category}] {self.title} for {self.recipient.username}"


class NotificationPreference(TimeStampedUUIDModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_preferences",
    )
    channel = models.CharField(max_length=30, default="in_app")
    category = models.CharField(max_length=30)
    enabled = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "channel", "category"],
                name="unique_user_channel_category",
            )
        ]
