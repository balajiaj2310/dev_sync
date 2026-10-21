import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db.models.functions import Lower
from django.db.models import Q
from apps.common.models import TimeStampedUUIDModel

class UserManager(BaseUserManager):
    """
    Custom user model manager where email and username are normalized to lower-case.
    """
    def create_user(self, username, email, password=None, **extra_fields):
        if not username:
            raise ValueError('The Username field must be set')
        if not email:
            raise ValueError('The Email field must be set')

        username = username.strip().lower()
        email = self.normalize_email(email).lower()

        extra_fields.setdefault('is_active', True)
        user = self.model(username=username, email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_email_verified', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(username, email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    Production-grade Custom User model with UUID pk, Argon2-hashed passwords,
    and unique lower-case username and email constraints.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=60, unique=True, db_index=True)
    email = models.EmailField(max_length=254, unique=True, db_index=True)
    mobile = models.CharField(max_length=24, blank=True, default='')
    
    first_name = models.CharField(max_length=100, blank=True, default='')
    last_name = models.CharField(max_length=100, blank=True, default='')
    
    is_email_verified = models.BooleanField(default=False, db_index=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email']

    class Meta:
        ordering = ['-date_joined']
        constraints = [
            models.UniqueConstraint(
                Lower('username'),
                name='unique_lower_username'
            ),
            models.UniqueConstraint(
                Lower('email'),
                name='unique_lower_email'
            ),
        ]

    def __str__(self):
        return f"@{self.username}"

    @property
    def full_name(self):
        name = f"{self.first_name} {self.last_name}".strip()
        return name if name else self.username


class Profile(TimeStampedUUIDModel):
    """
    Developer public and collaboration profile.
    """
    COLLAB_STATUS_CHOICES = [
        ('open_to_collab', 'Open for Collaboration'),
        ('available_for_hire', 'Available for Hire'),
        ('mentoring', 'Mentoring Others'),
        ('busy', 'Focused on Projects / Busy'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    headline = models.CharField(max_length=160, blank=True, default='')
    bio = models.TextField(max_length=2000, blank=True, default='')
    location = models.CharField(max_length=120, blank=True, default='')
    website = models.URLField(max_length=300, blank=True, default='')
    github_url = models.URLField(max_length=300, blank=True, default='')
    twitter_url = models.URLField(max_length=300, blank=True, default='')
    linkedin_url = models.URLField(max_length=300, blank=True, default='')
    
    collaboration_status = models.CharField(
        max_length=40,
        choices=COLLAB_STATUS_CHOICES,
        default='open_to_collab'
    )
    experience_level = models.CharField(max_length=40, default='Intermediate')
    avatar = models.ImageField(upload_to='avatars/%Y/%m/', null=True, blank=True)
    
    # Granular Preferences
    preferences = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"Profile of {self.user.username}"


class Skill(TimeStampedUUIDModel):
    """
    Technical skills tagged to developer profiles.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='skills')
    name = models.CharField(max_length=60, db_index=True)
    level = models.CharField(max_length=30, default='Proficient')

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'name'],
                name='unique_user_skill'
            )
        ]

    def __str__(self):
        return f"{self.user.username}: {self.name}"


class Education(TimeStampedUUIDModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='educations')
    institution = models.CharField(max_length=200)
    degree = models.CharField(max_length=120, blank=True, default='')
    field_of_study = models.CharField(max_length=120, blank=True, default='')
    start_year = models.PositiveIntegerField(null=True, blank=True)
    end_year = models.PositiveIntegerField(null=True, blank=True)

    def __str__(self):
        return f"{self.institution} ({self.user.username})"


class Experience(TimeStampedUUIDModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='experiences')
    company = models.CharField(max_length=160)
    title = models.CharField(max_length=120)
    location = models.CharField(max_length=120, blank=True, default='')
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    is_current = models.BooleanField(default=False)
    description = models.TextField(blank=True, default='')

    def __str__(self):
        return f"{self.title} at {self.company}"


class Achievement(TimeStampedUUIDModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='achievements')
    title = models.CharField(max_length=120)
    description = models.CharField(max_length=300, blank=True, default='')
    badge_icon = models.CharField(max_length=60, default='trophy')
    date_earned = models.DateField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} ({self.user.username})"


class Connection(TimeStampedUUIDModel):
    """
    Developer follow/connection model with pending/accepted/declined statuses.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
    ]

    requester = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_connections')
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_connections')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['requester', 'recipient'],
                name='unique_connection_pair'
            ),
            models.CheckConstraint(
                condition=~Q(requester=models.F('recipient')),
                name='prevent_self_connection'
            )
        ]

    def __str__(self):
        return f"{self.requester.username} -> {self.recipient.username} ({self.status})"
