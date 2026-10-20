from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView
from apps.ai_voice.views import AIChatView, voice_assistant_page

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # OpenAPI Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # DevSync API v1
    path('api/v1/', include('apps.accounts.urls')),
    path('api/v1/', include('apps.security.urls')),
    path('api/v1/', include('apps.repositories.urls')),
    path('api/v1/', include('apps.pulls.urls')),
    path('api/v1/', include('apps.issues.urls')),
    path('api/v1/', include('apps.teams.urls')),
    path('api/v1/', include('apps.notifications.urls')),
    path('api/v1/', include('apps.analytics.urls')),
    path('api/v1/', include('apps.chat.urls')),
    path('api/v1/', include('apps.ai_voice.urls')),

    # Compatibility shortcuts
    path('api/ai/chat', AIChatView.as_view(), name='legacy-ai-chat'),
    path('api/ai/chat/', AIChatView.as_view(), name='legacy-ai-chat-slash'),
    path('assistant', voice_assistant_page, name='voice-assistant-page'),
    path('assistant/', voice_assistant_page, name='voice-assistant-page-slash'),
    path('ai/assistant', voice_assistant_page, name='voice-assistant-page-alias'),
    path('assistant/index.html', voice_assistant_page, name='voice-assistant-page-html'),
]
