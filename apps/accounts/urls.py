from django.urls import path
from .views import (
    UsersMeView, PublicProfileView, DevelopersListView,
    PreferencesView, AvatarUploadView
)

urlpatterns = [
    path('users/me/', UsersMeView.as_view(), name='users-me'),
    path('users/me', UsersMeView.as_view(), name='users-me-noslash'),
    path('u/<str:username>/', PublicProfileView.as_view(), name='public-profile'),
    path('u/<str:username>', PublicProfileView.as_view(), name='public-profile-noslash'),
    path('developers/', DevelopersListView.as_view(), name='developers-list'),
    path('developers', DevelopersListView.as_view(), name='developers-list-noslash'),
    path('auth/preferences/', PreferencesView.as_view(), name='auth-preferences'),
    path('auth/preferences', PreferencesView.as_view(), name='auth-preferences-noslash'),
    path('settings/avatar/', AvatarUploadView.as_view(), name='settings-avatar'),
    path('settings/avatar', AvatarUploadView.as_view(), name='settings-avatar-noslash'),
]
