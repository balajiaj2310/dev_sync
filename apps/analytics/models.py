import uuid
import time
from django.db import models
from django.conf import settings
from apps.common.models import TimeStampedUUIDModel


class ActivityEvent(TimeStampedUUIDModel):
    EVENT_TYPES = [
        ('git_commit', 'Git Commit'),
        ('pull_request', 'Pull Request'),
        ('issue', 'Issue'),
        ('review', 'Review'),
        ('comment', 'Comment'),
        ('file_uploaded', 'File Uploaded'),
        ('task_completed', 'Task Completed'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='activity_events'
    )
    event_type = models.CharField(max_length=50, choices=EVENT_TYPES, db_index=True)
    repository = models.CharField(max_length=120, db_index=True, blank=True, default='devsync-core')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    visibility = models.CharField(max_length=20, default='Public')
    payload = models.JSONField(default=dict, blank=True)
    timestamp = models.FloatField(default=time.time, db_index=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.user.username}: {self.event_type} in {self.repository} ({self.title[:30]})"
