import uuid
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.common.models import TimeStampedUUIDModel


class Conversation(TimeStampedUUIDModel):
    CONV_TYPES = [
        ("direct", "Direct Message"),
        ("group", "Group Discussion"),
        ("channel", "Public Squad Channel"),
    ]

    title = models.CharField(max_length=150, blank=True, default="")
    conv_type = models.CharField(max_length=20, choices=CONV_TYPES, default="direct")
    slug = models.SlugField(max_length=160, blank=True, default="")
    custom_id = models.CharField(max_length=100, blank=True, default="", db_index=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return self.title or f"Conversation {self.id}"


class Participant(TimeStampedUUIDModel):
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="participants"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="chat_participations",
    )
    last_read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["conversation", "user"], name="unique_conversation_participant"
            )
        ]

    def __str__(self):
        return f"{self.user.username} in {self.conversation}"


class Message(TimeStampedUUIDModel):
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="messages"
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_messages"
    )
    text = models.TextField()
    reply_to = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="replies"
    )
    custom_id = models.CharField(max_length=100, blank=True, default="", db_index=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Msg by {self.sender.username}: {self.text[:30]}"


class Reaction(TimeStampedUUIDModel):
    message = models.ForeignKey(
        Message, on_delete=models.CASCADE, related_name="reactions"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="message_reactions",
    )
    emoji = models.CharField(max_length=20)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["message", "user", "emoji"], name="unique_message_user_reaction"
            )
        ]

    def __str__(self):
        return f"{self.emoji} by {self.user.username}"


class StatusUpdate(TimeStampedUUIDModel):
    AUDIENCE_CHOICES = [
        ("everyone", "Everyone"),
        ("connections", "Connections Only"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="status_updates",
    )
    text = models.CharField(max_length=280)
    audience = models.CharField(
        max_length=20, choices=AUDIENCE_CHOICES, default="everyone"
    )
    expires_at = models.DateTimeField(db_index=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def is_active(self):
        return timezone.now() < self.expires_at

    @classmethod
    def create_status(cls, user, text, audience="everyone", hours=24):
        expires_at = timezone.now() + timedelta(hours=hours)
        return cls.objects.create(
            user=user, text=text, audience=audience, expires_at=expires_at
        )
