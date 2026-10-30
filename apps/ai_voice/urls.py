from django.urls import path

from .views import (
    AIMentorChatView,
    AIMentorConversationDetailView,
    AIMentorConversationsView,
    AIMentorVoiceUploadView,
    AIChatView,
    VoiceContextView,
    VoiceSynthesizeView,
    VoiceTokenView,
    voice_assistant_page,
)

urlpatterns = [
    # New Voice-Enabled AI Mentor Endpoints
    path("ai/mentor/chat", AIMentorChatView.as_view(), name="ai-mentor-chat"),
    path("ai/mentor/chat/", AIMentorChatView.as_view(), name="ai-mentor-chat-slash"),
    path("ai/mentor/voice", AIMentorVoiceUploadView.as_view(), name="ai-mentor-voice"),
    path(
        "ai/mentor/voice/",
        AIMentorVoiceUploadView.as_view(),
        name="ai-mentor-voice-slash",
    ),
    path(
        "ai/mentor/conversations",
        AIMentorConversationsView.as_view(),
        name="ai-mentor-conversations",
    ),
    path(
        "ai/mentor/conversations/",
        AIMentorConversationsView.as_view(),
        name="ai-mentor-conversations-slash",
    ),
    path(
        "ai/mentor/conversations/new",
        AIMentorConversationsView.as_view(),
        name="ai-mentor-conversations-new",
    ),
    path(
        "ai/mentor/conversations/new/",
        AIMentorConversationsView.as_view(),
        name="ai-mentor-conversations-new-slash",
    ),
    path(
        "ai/mentor/conversations/<uuid:conversation_id>",
        AIMentorConversationDetailView.as_view(),
        name="ai-mentor-conv-detail",
    ),
    path(
        "ai/mentor/conversations/<uuid:conversation_id>/",
        AIMentorConversationDetailView.as_view(),
        name="ai-mentor-conv-detail-slash",
    ),
    # Existing preserved endpoints
    path("ai/voice/token", VoiceTokenView.as_view(), name="ai-voice-token"),
    path("ai/voice/token/", VoiceTokenView.as_view(), name="ai-voice-token-slash"),
    path("ai/voice/context", VoiceContextView.as_view(), name="ai-voice-context"),
    path(
        "ai/voice/context/", VoiceContextView.as_view(), name="ai-voice-context-slash"
    ),
    path(
        "ai/voice/synthesize", VoiceSynthesizeView.as_view(), name="ai-voice-synthesize"
    ),
    path(
        "ai/voice/synthesize/",
        VoiceSynthesizeView.as_view(),
        name="ai-voice-synthesize-slash",
    ),
    path("ai/chat", AIChatView.as_view(), name="ai-chat"),
    path("ai/chat/", AIChatView.as_view(), name="ai-chat-slash"),
]
