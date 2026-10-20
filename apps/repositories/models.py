import hashlib
import uuid

from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedUUIDModel


class Repository(TimeStampedUUIDModel):
    VISIBILITY_CHOICES = [
        ("public", "Public"),
        ("private", "Private"),
    ]

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owned_repositories",
    )
    name = models.CharField(max_length=120, db_index=True)
    slug = models.SlugField(max_length=140, db_index=True)
    description = models.TextField(blank=True, default="")
    visibility = models.CharField(
        max_length=20, choices=VISIBILITY_CHOICES, default="public", db_index=True
    )
    default_branch = models.CharField(max_length=80, default="main")
    stars_count = models.PositiveIntegerField(default=0)
    forks_count = models.PositiveIntegerField(default=0)
    icon_bg = models.CharField(max_length=20, default="#10B981")
    tags = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["-updated_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["owner", "name"], name="unique_owner_repository"
            )
        ]

    def __str__(self):
        return f"{self.owner.username}/{self.name}"

    @property
    def full_name(self):
        return f"{self.owner.username}/{self.name}"


class Branch(TimeStampedUUIDModel):
    repository = models.ForeignKey(
        Repository, on_delete=models.CASCADE, related_name="branches"
    )
    name = models.CharField(max_length=100)
    is_default = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["repository", "name"], name="unique_repo_branch"
            )
        ]

    def __str__(self):
        return f"{self.repository.name}:{self.name}"


class Commit(TimeStampedUUIDModel):
    repository = models.ForeignKey(
        Repository, on_delete=models.CASCADE, related_name="commits"
    )
    branch = models.ForeignKey(
        Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name="commits"
    )
    sha = models.CharField(max_length=40, db_index=True)
    message = models.TextField()
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    author_name = models.CharField(max_length=120, blank=True, default="")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.sha[:7]} - {self.message[:40]}"


class FileBlob(TimeStampedUUIDModel):
    """
    Database-stored file versioning. Secure against path traversal attacks.
    Path is strictly sanitized relative path.
    """

    repository = models.ForeignKey(
        Repository, on_delete=models.CASCADE, related_name="file_blobs"
    )
    branch = models.ForeignKey(
        Branch, on_delete=models.CASCADE, related_name="file_blobs"
    )
    path = models.CharField(max_length=500, db_index=True)
    content = models.TextField(blank=True, default="")
    size = models.PositiveIntegerField(default=0)
    mime_type = models.CharField(max_length=100, default="text/plain")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["repository", "branch", "path"],
                name="unique_repo_branch_filepath",
            )
        ]

    def __str__(self):
        return f"{self.repository.name}@{self.branch.name}:{self.path}"

    @classmethod
    def sanitize_path(cls, path_str: str) -> str:
        parts = [
            p
            for p in path_str.replace("\\", "/").split("/")
            if p and p != "." and p != ".."
        ]
        return "/".join(parts)


class Attachment(TimeStampedUUIDModel):
    repository = models.ForeignKey(
        Repository, on_delete=models.CASCADE, related_name="attachments"
    )
    uploader = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    filename = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField(default=0)
    file_type = models.CharField(max_length=100, default="application/octet-stream")
    file = models.FileField(upload_to="attachments/%Y/%m/", null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]


class Collaborator(TimeStampedUUIDModel):
    ROLE_CHOICES = [
        ("Admin", "Admin"),
        ("Lead Maintainer", "Lead Maintainer"),
        ("Maintainer", "Maintainer"),
        ("Contributor", "Contributor"),
        ("Fullstack Developer", "Fullstack Developer"),
        ("Viewer", "Viewer"),
    ]

    repository = models.ForeignKey(
        Repository, on_delete=models.CASCADE, related_name="collaborators"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="collaborations",
    )
    role = models.CharField(max_length=50, choices=ROLE_CHOICES, default="Contributor")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["repository", "user"], name="unique_repo_collaborator"
            )
        ]

    def __str__(self):
        return f"{self.user.username} in {self.repository.name} ({self.role})"


class Star(TimeStampedUUIDModel):
    repository = models.ForeignKey(
        Repository, on_delete=models.CASCADE, related_name="stars"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="starred_repos"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["repository", "user"], name="unique_repo_star"
            )
        ]


class Fork(TimeStampedUUIDModel):
    original_repository = models.ForeignKey(
        Repository, on_delete=models.CASCADE, related_name="forks"
    )
    forked_repository = models.OneToOneField(
        Repository, on_delete=models.CASCADE, related_name="source_fork"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="user_forks"
    )
