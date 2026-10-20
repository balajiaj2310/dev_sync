from django.urls import path
from .views import (
    ChatConversationsView, ConversationMessagesView, MessageReactionView, ChatStatusesView
)

urlpatterns = [
    path('chat/conversations/', ChatConversationsView.as_view(), name='chat-conversations'),
    path('chat/conversations', ChatConversationsView.as_view(), name='chat-conversations-noslash'),
    path('chat/conversations/<str:conv_id>/messages/', ConversationMessagesView.as_view(), name='chat-messages'),
    path('chat/conversations/<str:conv_id>/messages', ConversationMessagesView.as_view(), name='chat-messages-noslash'),
    path('chat/messages/<str:msg_id>/react/', MessageReactionView.as_view(), name='chat-react'),
    path('chat/messages/<str:msg_id>/react', MessageReactionView.as_view(), name='chat-react-noslash'),
    path('chat/statuses/', ChatStatusesView.as_view(), name='chat-statuses'),
    path('chat/statuses', ChatStatusesView.as_view(), name='chat-statuses-noslash'),
]
