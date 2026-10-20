import uuid

from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedUUIDModel
from apps.repositories.models import Repository


class Label(TimeStampedUUIDModel):
    repository = models.ForeignKey(
        Repository,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="labels",
    )
    name = models.CharField(max_length=60)
    color = models.CharField(max_length=20, default="#10B981")
    description = models.CharField(max_length=200, blank=True, default="")

    def __str__(self):
        return self.name


class Milestone(TimeStampedUUIDModel):
    STATUS_CHOICES = [
        ("Open", "Open"),
        ("Closed", "Closed"),
    ]

    repository = models.ForeignKey(
        Repository, on_delete=models.CASCADE, related_name="milestones"
    )
    title = models.CharField(max_length=120)
    description = models.TextField(blank=True, default="")
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Open")

    def __str__(self):
        return f"{self.title} ({self.repository.name})"


class Issue(TimeStampedUUIDModel):
    STATUS_CHOICES = [
        ("Open", "Open"),
        ("Closed", "Closed"),
    ]

    repository = models.ForeignKey(
        Repository, on_delete=models.CASCADE, related_name="issues"
    )
    number = models.PositiveIntegerField(db_index=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="authored_issues",
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="Open", db_index=True
    )
    labels = models.ManyToManyField(Label, blank=True, related_name="issues")
    milestone = models.ForeignKey(
        Milestone,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="issues",
    )
    assignees = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, related_name="assigned_issues"
    )
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="closed_issues",
    )

    class Meta:
        ordering = ["-number"]
        constraints = [
            models.UniqueConstraint(
                fields=["repository", "number"], name="unique_repo_issue_number"
            )
        ]

    def __str__(self):
        return f"Issue #{self.number}: {self.title} ({self.status})"


class IssueComment(TimeStampedUUIDModel):
    issue = models.ForeignKey(Issue, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="issue_comments",
    )
    text = models.TextField()

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Comment by {self.author.username} on Issue #{self.issue.number}"
