import uuid

from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedUUIDModel
from apps.repositories.models import Repository


class PullRequest(TimeStampedUUIDModel):
    STATUS_CHOICES = [
        ("Open", "Open"),
        ("Review", "Under Review"),
        ("Merged", "Merged"),
        ("Closed", "Closed"),
    ]

    repository = models.ForeignKey(
        Repository, on_delete=models.CASCADE, related_name="pull_requests"
    )
    number = models.PositiveIntegerField(db_index=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="pull_requests"
    )
    source_branch = models.CharField(max_length=100)
    target_branch = models.CharField(max_length=100, default="main")
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="Open", db_index=True
    )
    is_mergeable = models.BooleanField(default=True)
    merged_at = models.DateTimeField(null=True, blank=True)
    merged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="merged_pull_requests",
    )
    changed_files = models.JSONField(default=list, blank=True)
    additions = models.PositiveIntegerField(default=0)
    deletions = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-number"]
        constraints = [
            models.UniqueConstraint(
                fields=["repository", "number"], name="unique_repo_pr_number"
            )
        ]

    def __str__(self):
        return f"PR #{self.number}: {self.title} ({self.status})"

    def can_merge(self, actor_user) -> tuple[bool, str]:
        if self.status == "Merged":
            return False, "Pull request has already been merged."
        if self.status == "Closed":
            return False, "Pull request is closed and cannot be merged."
        if self.source_branch == self.target_branch:
            return False, "Source and target branch cannot be identical."

        # Check source and target branches exist
        if not self.repository.branches.filter(name=self.source_branch).exists():
            return (
                False,
                f"Source branch '{self.source_branch}' does not exist in repository.",
            )
        if not self.repository.branches.filter(name=self.target_branch).exists():
            return (
                False,
                f"Target branch '{self.target_branch}' does not exist in repository.",
            )

        # Check merge permissions (Fix p)
        if actor_user:
            is_owner = self.repository.owner_id == actor_user.id
            is_collab = self.repository.collaborators.filter(
                user=actor_user,
                role__in=["Admin", "Lead Maintainer", "Maintainer", "Contributor"],
            ).exists()
            if not is_owner and not is_collab:
                return (
                    False,
                    "You do not have write permission to merge pull requests in this repository.",
                )

        return True, "Ready to merge."


class PRReview(TimeStampedUUIDModel):
    ACTION_CHOICES = [
        ("approve", "Approve"),
        ("request_changes", "Request Changes"),
        ("comment", "Comment"),
    ]

    pull_request = models.ForeignKey(
        PullRequest, on_delete=models.CASCADE, related_name="reviews"
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="pr_reviews"
    )
    action = models.CharField(max_length=30, choices=ACTION_CHOICES, default="approve")
    comment = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Review by {self.reviewer.username} on PR #{self.pull_request.number}: {self.action}"


class PRComment(TimeStampedUUIDModel):
    pull_request = models.ForeignKey(
        PullRequest, on_delete=models.CASCADE, related_name="comments"
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="pr_comments"
    )
    text = models.TextField()
    path = models.CharField(max_length=500, blank=True, default="")
    line_number = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Comment by {self.author.username} on PR #{self.pull_request.number}"
