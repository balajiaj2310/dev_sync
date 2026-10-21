import threading
from django.core.mail import send_mail
from django.conf import settings


def _send_mail_worker(subject, message, from_email, recipient_list, html_message=None):
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=from_email or getattr(settings, 'DEFAULT_FROM_EMAIL', None),
            recipient_list=recipient_list,
            html_message=html_message,
            fail_silently=True
        )
    except Exception:
        pass


def send_email_async(subject, message, recipient_list, from_email=None, html_message=None):
    """
    Dispatches email asynchronously in a daemon thread so it never blocks
    the HTTP request thread.
    """
    t = threading.Thread(
        target=_send_mail_worker,
        args=(subject, message, from_email, recipient_list, html_message),
        daemon=True
    )
    t.start()
    return t
