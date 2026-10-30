import uuid
from django.db import models
from django.conf import settings
from apps.common.models import TimeStampedUUIDModel


class AIMentorConversation(TimeStampedUUIDModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ai_mentor_conversations',
        null=True,
        blank=True
    )
    title = models.CharField(max_length=200, default='New Conversation')
    repo = models.CharField(max_length=100, blank=True, default='devsync-core')
    branch = models.CharField(max_length=100, blank=True, default='main')

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.title} ({self.id})"


class AIMentorMessage(TimeStampedUUIDModel):
    ROLE_CHOICES = [
        ('user', 'User'),
        ('mentor', 'AI Mentor'),
    ]

    conversation = models.ForeignKey(
        AIMentorConversation,
        on_delete=models.CASCADE,
        related_name='messages'
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    content = models.TextField()
    audio_base64 = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"[{self.role}] {self.content[:40]}"
