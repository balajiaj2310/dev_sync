from django.urls import path
from .views import (
    VoiceTokenView, VoiceContextView, AIChatView,
    VoiceSynthesizeView, voice_assistant_page
)

urlpatterns = [
    path('ai/voice/token', VoiceTokenView.as_view(), name='ai-voice-token'),
    path('ai/voice/token/', VoiceTokenView.as_view(), name='ai-voice-token-slash'),
    path('ai/voice/context', VoiceContextView.as_view(), name='ai-voice-context'),
    path('ai/voice/context/', VoiceContextView.as_view(), name='ai-voice-context-slash'),
    path('ai/voice/synthesize', VoiceSynthesizeView.as_view(), name='ai-voice-synthesize'),
    path('ai/voice/synthesize/', VoiceSynthesizeView.as_view(), name='ai-voice-synthesize-slash'),
    path('ai/chat', AIChatView.as_view(), name='ai-chat'),
    path('ai/chat/', AIChatView.as_view(), name='ai-chat-slash'),
]
