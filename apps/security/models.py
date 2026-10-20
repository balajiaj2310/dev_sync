import hashlib
import secrets
import uuid
from datetime import timedelta

from django.conf import settings
from django.db import models, transaction
from django.utils import timezone

from apps.common.models import TimeStampedUUIDModel


class AuthSession(TimeStampedUUIDModel):
    """
    Server-side database authentication sessions.
    Stores cryptographically secure SHA-256 hash of the session token.
    Never stores plaintext tokens.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="auth_sessions"
    )
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    device = models.CharField(max_length=120, default="Unknown Device")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default="")

    expires_at = models.DateTimeField(db_index=True)
    last_active = models.DateTimeField(auto_now=True)
    revoked_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        ordering = ["-last_active"]

    @property
    def is_active(self):
        return self.revoked_at is None and timezone.now() < self.expires_at

    @property
    def is_valid(self):
        return self.is_active

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at

    @classmethod
    def hash_token(cls, raw_token: str) -> str:
        return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    def revoke(self):
        self.revoked_at = timezone.now()
        self.save(update_fields=["revoked_at"])


class AuditLog(TimeStampedUUIDModel):
    """
    Security audit trail and login history.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    action = models.CharField(max_length=80, db_index=True)
    description = models.TextField(blank=True, default="")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, default="success")

    class Meta:
        ordering = ["-created_at"]


class OTPChallenge(TimeStampedUUIDModel):
    """
    Salted and SHA-256 hashed 6-digit OTP verification challenges.
    Never stores raw codes in the database.
    """

    PURPOSE_CHOICES = [
        ("email_verify", "Email Verification"),
        ("password_reset", "Password Reset"),
        ("mobile_verify", "Mobile Verification"),
        ("sensitive_action", "Sensitive Action Reauth"),
    ]

    identifier = models.CharField(max_length=254, db_index=True)
    code_hash = models.CharField(max_length=64)
    salt = models.CharField(max_length=32)
    purpose = models.CharField(max_length=30, choices=PURPOSE_CHOICES, db_index=True)
    attempts_remaining = models.PositiveSmallIntegerField(default=5)
    expires_at = models.DateTimeField(db_index=True)
    consumed_at = models.DateTimeField(null=True, blank=True, db_index=True)

    @property
    def attempts_left(self):
        return self.attempts_remaining

    @classmethod
    def hash_code(cls, salt: str, code: str) -> str:
        return hashlib.sha256(f"{salt}:{code}".encode("utf-8")).hexdigest()

    @classmethod
    def create_challenge(
        cls, identifier: str, purpose: str = "password_reset", expiry_minutes: int = 5
    ):
        raw_code = f"{secrets.randbelow(900000) + 100000}"
        salt = secrets.token_hex(16)
        code_hash = cls.hash_code(salt, raw_code)
        expires_at = timezone.now() + timedelta(minutes=expiry_minutes)
        challenge = cls.objects.create(
            identifier=identifier,
            code_hash=code_hash,
            salt=salt,
            purpose=purpose,
            attempts_remaining=3,
            expires_at=expires_at,
        )
        return challenge, raw_code

    @property
    def is_valid(self):
        return (
            self.consumed_at is None
            and self.attempts_remaining > 0
            and timezone.now() < self.expires_at
        )

    def verify(self, candidate_code: str) -> bool:
        if not self.is_valid:
            return False

        self.attempts_remaining -= 1
        expected = self.code_hash
        submitted = self.hash_code(self.salt, candidate_code.strip())

        if secrets.compare_digest(submitted, expected):
            self.consumed_at = timezone.now()
            self.save(update_fields=["attempts_remaining", "consumed_at"])
            return True

        self.save(update_fields=["attempts_remaining"])
        return False


class ReauthToken(TimeStampedUUIDModel):
    """
    Short-lived, single-use re-authentication token (5 minutes validity)
    required for high-risk operations: password change, 2FA toggle, account deletion.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reauth_tokens"
    )
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    expires_at = models.DateTimeField(db_index=True)
    consumed_at = models.DateTimeField(null=True, blank=True, db_index=True)

    @classmethod
    def hash_token(cls, raw_token: str) -> str:
        return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    @property
    def is_valid(self):
        return self.consumed_at is None and timezone.now() < self.expires_at

    def consume(self):
        self.consumed_at = timezone.now()
        self.save(update_fields=["consumed_at"])

    @classmethod
    def generate_for_user(cls, user, validity_minutes: int = 5):
        raw_token = f"rat_{secrets.token_urlsafe(32)}"
        token_hash = cls.hash_token(raw_token)
        expires_at = timezone.now() + timedelta(minutes=validity_minutes)
        token_obj = cls.objects.create(
            user=user, token_hash=token_hash, expires_at=expires_at
        )
        return raw_token, token_obj

    @classmethod
    def verify_and_consume(cls, user, raw_token: str) -> bool:
        token_hash = cls.hash_token(raw_token)
        with transaction.atomic():
            token_obj = (
                cls.objects.select_for_update()
                .filter(
                    user=user,
                    token_hash=token_hash,
                    consumed_at__isnull=True,
                    expires_at__gt=timezone.now(),
                )
                .first()
            )
            if not token_obj:
                return False
            token_obj.consume()
            return True


class TOTPDevice(TimeStampedUUIDModel):
    """
    Standard RFC 6238 TOTP Multi-Factor Authentication device.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="totp_device"
    )
    secret = models.CharField(max_length=64)
    is_confirmed = models.BooleanField(default=False)

    def __str__(self):
        return f"TOTP ({self.user.username}) - Confirmed: {self.is_confirmed}"


class RecoveryCode(TimeStampedUUIDModel):
    """
    Hashed backup recovery codes for 2FA.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="recovery_codes",
    )
    code_hash = models.CharField(max_length=64, db_index=True)
    consumed_at = models.DateTimeField(null=True, blank=True, db_index=True)

    @classmethod
    def hash_code(cls, raw_code: str) -> str:
        return hashlib.sha256(
            raw_code.strip().replace("-", "").encode("utf-8")
        ).hexdigest()
