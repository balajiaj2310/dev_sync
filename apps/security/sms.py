import logging
from abc import ABC, abstractmethod

from django.conf import settings

logger = logging.getLogger(__name__)


class BaseSMSProvider(ABC):
    @abstractmethod
    def send_sms(self, to_number: str, message: str) -> bool:
        pass


class ConsoleSMSProvider(BaseSMSProvider):
    """
    Development SMS provider that logs outgoing messages via the Django logging framework
    without exposing raw secrets or writing to arbitrary disk files.
    """

    def send_sms(self, to_number: str, message: str) -> bool:
        # Mask digits of phone number for privacy
        masked = f"{to_number[:3]}***{to_number[-2:]}" if len(to_number) >= 5 else "***"
        logger.info(f"[DEV SMS] Dispatching SMS to {masked}: {message}")
        return True


class MockSMSProvider(BaseSMSProvider):
    """
    In-memory SMS provider for unit tests.
    """

    sent_messages = []

    def send_sms(self, to_number: str, message: str) -> bool:
        self.sent_messages.append({"to": to_number, "message": message})
        return True

    @classmethod
    def clear(cls):
        cls.sent_messages = []


def get_sms_provider() -> BaseSMSProvider:
    provider_name = getattr(settings, "SMS_PROVIDER", "console").lower()
    if provider_name == "mock":
        return MockSMSProvider()
    return ConsoleSMSProvider()
