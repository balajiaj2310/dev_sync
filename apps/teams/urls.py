from django.urls import path
from .views import (
    TeamsListView, TeamMembersListView, TeamMemberInviteView, TeamMemberDetailView
)

urlpatterns = [
    path('teams/', TeamsListView.as_view(), name='teams-list'),
    path('teams', TeamsListView.as_view(), name='teams-list-noslash'),
    path('teams/members/', TeamMembersListView.as_view(), name='teams-members-list'),
    path('teams/members', TeamMembersListView.as_view(), name='teams-members-list-noslash'),
    path('teams/members/invite/', TeamMemberInviteView.as_view(), name='teams-member-invite'),
    path('teams/members/invite', TeamMemberInviteView.as_view(), name='teams-member-invite-noslash'),
    path('teams/members/<str:username>/', TeamMemberDetailView.as_view(), name='teams-member-detail'),
    path('teams/members/<str:username>', TeamMemberDetailView.as_view(), name='teams-member-detail-noslash'),
]
