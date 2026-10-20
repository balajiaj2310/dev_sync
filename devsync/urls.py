import re

from django.contrib import admin
from django.urls import include, path, re_path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

from apps.ai_voice.views import AIChatView
from devsync.views import (
    page_assistant,
    page_developer_profile,
    page_home,
    page_notifications,
    page_settings_security,
    page_settings_security_password,
    render_custom_error,
    serve_static_asset,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    # OpenAPI Documentation
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    # DevSync API v1
    path("api/v1/", include("apps.accounts.urls")),
    path("api/v1/", include("apps.security.urls")),
    path("api/v1/", include("apps.repositories.urls")),
    path("api/v1/", include("apps.pulls.urls")),
    path("api/v1/", include("apps.issues.urls")),
    path("api/v1/", include("apps.teams.urls")),
    path("api/v1/", include("apps.notifications.urls")),
    path("api/v1/", include("apps.analytics.urls")),
    path("api/v1/", include("apps.chat.urls")),
    path("api/v1/", include("apps.ai_voice.urls")),
    # Compatibility shortcuts
    path("api/ai/chat", AIChatView.as_view(), name="legacy-ai-chat"),
    path("api/ai/chat/", AIChatView.as_view(), name="legacy-ai-chat-slash"),
    # Frontend Page Routes (single trailing slash policy supported)
    re_path(r"^$", page_home, name="page-home"),
    re_path(r"^home/?$", page_home, name="page-home-alias"),
    re_path(r"^notifications/?$", page_notifications, name="page-notifications"),
    re_path(r"^assistant/?$", page_assistant, name="page-assistant"),
    re_path(r"^ai/assistant/?$", page_assistant, name="page-ai-assistant"),
    re_path(r"^assistant/index\.html$", page_assistant, name="page-assistant-html"),
    re_path(
        r"^settings/security/?$", page_settings_security, name="page-settings-security"
    ),
    re_path(
        r"^settings/security/password/?$",
        page_settings_security_password,
        name="page-settings-security-password",
    ),
    re_path(
        r"^u/(?P<username>[^/]+)/?$", page_developer_profile, name="page-user-profile"
    ),
    re_path(
        r"^developers/(?P<username>[^/]+)/?$",
        page_developer_profile,
        name="page-developer-profile",
    ),
    # Direct static assets serving for frontend (/src/... and /public/...)
    re_path(r"^src/(?P<path>.*)$", serve_static_asset),
    re_path(r"^public/(?P<path>.*)$", serve_static_asset),
]

# Custom Error Handlers
handler400 = "devsync.views.handler400"
handler403 = "devsync.views.handler403"
handler404 = "devsync.views.handler404"
handler500 = "devsync.views.handler500"
