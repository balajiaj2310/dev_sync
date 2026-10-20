import mimetypes
import os
from pathlib import Path

from django.conf import settings
from django.http import Http404, HttpResponse, JsonResponse
from django.shortcuts import render

FRONTEND_DIR = Path(settings.BASE_DIR) / "frontend"


def _serve_frontend_file(relative_path: str, status_code: int = 200) -> HttpResponse:
    target = FRONTEND_DIR / relative_path
    if not target.exists() or target.is_dir():
        return render_custom_error(404, "Page not found")

    content_type, _ = mimetypes.guess_type(str(target))
    content_type = content_type or "text/html"

    with open(target, "rb") as f:
        content = f.read()

    return HttpResponse(content, content_type=content_type, status=status_code)


def serve_static_asset(request, path: str):
    """Serve assets from frontend/src or frontend/public with realpath security check."""
    # Prevent directory traversal
    clean_path = path.lstrip("/\\")

    # Try public directory first, then src
    for base in [FRONTEND_DIR / "public", FRONTEND_DIR / "src", FRONTEND_DIR]:
        target = (base / clean_path).resolve()
        # Ensure path stays within FRONTEND_DIR
        if str(target).startswith(str(FRONTEND_DIR.resolve())) and target.is_file():
            content_type, _ = mimetypes.guess_type(str(target))
            with open(target, "rb") as f:
                return HttpResponse(
                    f.read(), content_type=content_type or "application/octet-stream"
                )

    raise Http404("Asset not found")


def page_home(request):
    """Home / landing page."""
    return _serve_frontend_file("src/index.html")


def page_notifications(request):
    """Notifications page."""
    return _serve_frontend_file("src/pages/notifications/index.html")


def page_assistant(request):
    """Voice AI assistant page."""
    return _serve_frontend_file("src/pages/assistant/index.html")


def page_settings_security(request):
    """Dedicated Security & Password settings overview page."""
    return _serve_frontend_file("src/pages/settings/security.html")


def page_settings_security_password(request):
    """Dedicated Change Password page."""
    return _serve_frontend_file("src/pages/settings/change-password.html")


def page_developer_profile(request, username: str):
    """Public Developer Profile (/u/<username> and /developers/<username>/)."""
    return _serve_frontend_file("src/pages/developers/profile.html")


# Custom Error Handlers
def render_custom_error(code: int, message: str = "") -> HttpResponse:
    error_html = FRONTEND_DIR / "src" / "pages" / "errors" / f"{code}.html"
    if error_html.exists():
        with open(error_html, "r", encoding="utf-8") as f:
            content = f.read()
        return HttpResponse(content, content_type="text/html", status=code)
    return HttpResponse(
        f"<h1>{code} Error</h1><p>{message}</p>", content_type="text/html", status=code
    )


def handler400(request, exception=None):
    if request.path.startswith("/api/"):
        return JsonResponse({"error": "Bad request", "status_code": 400}, status=400)
    return render_custom_error(400, "Bad Request")


def handler401(request, exception=None):
    if request.path.startswith("/api/"):
        return JsonResponse(
            {"error": "Unauthorized. Authentication required.", "status_code": 401},
            status=401,
        )
    return render_custom_error(401, "Unauthorized")


def handler403(request, exception=None):
    if request.path.startswith("/api/"):
        return JsonResponse(
            {"error": "Forbidden. Access denied.", "status_code": 403}, status=403
        )
    return render_custom_error(403, "Access Denied")


def handler404(request, exception=None):
    if request.path.startswith("/api/"):
        return JsonResponse(
            {"error": "Endpoint not found", "status_code": 404}, status=404
        )
    return render_custom_error(404, "Page Not Found")


def handler405(request, exception=None):
    if request.path.startswith("/api/"):
        return JsonResponse(
            {"error": "Method Not Allowed", "status_code": 405}, status=405
        )
    return render_custom_error(405, "Method Not Allowed")


def handler429(request, exception=None):
    if request.path.startswith("/api/"):
        return JsonResponse(
            {"error": "Too many requests. Rate limit exceeded.", "status_code": 429},
            status=429,
        )
    return render_custom_error(429, "Too Many Requests")


def handler500(request):
    if request.path.startswith("/api/"):
        return JsonResponse(
            {"error": "Internal server error", "status_code": 500}, status=500
        )
    return render_custom_error(500, "Server Error")
