from django.core.cache import cache
from django.utils import timezone
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    scope = "auth_attempt"
    rate = "10/minute"


class VoiceAIRateThrottle(UserRateThrottle):
    scope = "ai_voice"
    rate = "30/minute"


class LoginLockoutManager:
    """
    Tracks failed login attempts by normalized identifier.
    Locks out account for 15 minutes upon 5 consecutive failed attempts.
    """

    MAX_ATTEMPTS = 5
    LOCKOUT_SECONDS = 900  # 15 minutes

    @classmethod
    def _cache_key(cls, identifier: str) -> str:
        clean = identifier.strip().lower()
        return f"login_lockout:{clean}"

    @classmethod
    def is_locked(cls, identifier: str) -> bool:
        key = cls._cache_key(identifier)
        attempts = cache.get(key, 0)
        return attempts >= cls.MAX_ATTEMPTS

    @classmethod
    def record_failure(cls, identifier: str) -> int:
        key = cls._cache_key(identifier)
        attempts = cache.get(key, 0) + 1
        cache.set(key, attempts, timeout=cls.LOCKOUT_SECONDS)
        return attempts

    @classmethod
    def reset(cls, identifier: str):
        key = cls._cache_key(identifier)
        cache.delete(key)
