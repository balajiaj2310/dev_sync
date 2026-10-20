import secrets
from datetime import timedelta

from django.utils import timezone
from rest_framework import authentication, exceptions

from .models import AuthSession


class DevSyncTokenAuthentication(authentication.BaseAuthentication):
    """
    Production-grade Session Token Authentication.
    Reads token from 'Authorization: Bearer <token>' header
    or 'devsync_session' HttpOnly cookie.
    Validates against server-side hashed AuthSession in the database.
    """

    def authenticate(self, request):
        raw_token = None

        # 1. Check Bearer header
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            raw_token = auth_header[7:].strip()

        # 2. Check HttpOnly cookie fallback
        if not raw_token:
            raw_token = request.COOKIES.get("devsync_session")

        if not raw_token:
            return None

        token_hash = AuthSession.hash_token(raw_token)
        try:
            session = AuthSession.objects.select_related("user").get(
                token_hash=token_hash,
                revoked_at__isnull=True,
                expires_at__gt=timezone.now(),
            )
        except AuthSession.DoesNotExist:
            raise exceptions.AuthenticationFailed(
                "Invalid, expired, or revoked session token."
            )

        if not session.user.is_active:
            raise exceptions.AuthenticationFailed(
                "User account is inactive or disabled."
            )

        # Attach active session object to request for easy revocation
        request.auth_session = session
        return (session.user, session)


def parse_device_info(request=None):
    """Extract human-readable device and IP info from request headers."""
    if request is None or not hasattr(request, "META"):
        return "Desktop Browser", "127.0.0.1", "DevSync Client"

    ua = request.META.get("HTTP_USER_AGENT", "Unknown Browser / OS")
    ip = request.META.get("HTTP_X_FORWARDED_FOR")
    if ip:
        ip = ip.split(",")[0].strip()
    else:
        ip = request.META.get("REMOTE_ADDR", "127.0.0.1")

    # Simple device labeling
    device = "Desktop Browser"
    if "Mobile" in ua:
        device = "Mobile Device"
    elif "Postman" in ua or "curl" in ua or "Python" in ua:
        device = "API Client"

    return device, ip, ua


def create_user_session(user, request=None, duration_days=30):
    """
    Creates a new database AuthSession, returning the raw token (to deliver to client)
    and the created AuthSession model instance.
    """
    raw_token = f"dst_{secrets.token_urlsafe(32)}"
    token_hash = AuthSession.hash_token(raw_token)
    device, ip, ua = parse_device_info(request)
    expires_at = timezone.now() + timedelta(days=duration_days)

    session = AuthSession.objects.create(
        user=user,
        token_hash=token_hash,
        device=device,
        ip_address=ip if ip and len(ip) <= 45 else "127.0.0.1",
        user_agent=ua,
        expires_at=expires_at,
    )
    return raw_token, session
