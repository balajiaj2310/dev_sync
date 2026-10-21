import uuid
import secrets
from datetime import timedelta
from django.db import models
from django.conf import settings
from django.utils import timezone
from apps.common.models import TimeStampedUUIDModel


class Team(TimeStampedUUIDModel):
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True)
    description = models.TextField(blank=True, default='')
    avatar = models.URLField(
        default='https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=64&q=80'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_teams'
    )

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

    @property
    def members_count(self):
        return self.memberships.count()


class Membership(TimeStampedUUIDModel):
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='team_memberships')
    role = models.CharField(max_length=60, default='Contributor')
    project = models.CharField(max_length=100, blank=True, default='')

    class Meta:
        ordering = ['role', 'user__username']
        constraints = [
            models.UniqueConstraint(fields=['team', 'user'], name='unique_team_user_membership')
        ]

    def __str__(self):
        return f"{self.user.username} in {self.team.name} ({self.role})"


class Invitation(TimeStampedUUIDModel):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
        ('expired', 'Expired'),
    ]

    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='invitations')
    email = models.EmailField()
    name = models.CharField(max_length=120, blank=True, default='')
    role = models.CharField(max_length=60, default='Fullstack Developer')
    project = models.CharField(max_length=100, blank=True, default='')
    token = models.CharField(max_length=64, unique=True, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    expires_at = models.DateTimeField()

    @classmethod
    def create_invitation(cls, team, email, name='', role='Fullstack Developer', project='', expiry_days=7):
        token = secrets.token_urlsafe(32)
        expires_at = timezone.now() + timedelta(days=expiry_days)
        return cls.objects.create(
            team=team,
            email=email,
            name=name,
            role=role,
            project=project,
            token=token,
            expires_at=expires_at
        )
