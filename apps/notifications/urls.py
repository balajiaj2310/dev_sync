from django.urls import path
from .views import (
    NotificationsListView, NotificationConnectionActionView,
    NotificationMarkReadView, NotificationMarkUnreadView, NotificationDetailView
)

urlpatterns = [
    path('notifications/', NotificationsListView.as_view(), name='notifications-list'),
    path('notifications', NotificationsListView.as_view(), name='notifications-list-noslash'),
    path('notifications/connection-action/', NotificationConnectionActionView.as_view(), name='notifications-connection-action'),
    path('notifications/connection-action', NotificationConnectionActionView.as_view(), name='notifications-connection-action-noslash'),
    path('notifications/mark-read/', NotificationMarkReadView.as_view(), name='notifications-mark-read'),
    path('notifications/mark-read', NotificationMarkReadView.as_view(), name='notifications-mark-read-noslash'),
    path('notifications/mark-unread/', NotificationMarkUnreadView.as_view(), name='notifications-mark-unread'),
    path('notifications/mark-unread', NotificationMarkUnreadView.as_view(), name='notifications-mark-unread-noslash'),
    path('notifications/<str:notif_id>/', NotificationDetailView.as_view(), name='notification-detail'),
    path('notifications/<str:notif_id>', NotificationDetailView.as_view(), name='notification-detail-noslash'),
]
