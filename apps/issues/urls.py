from django.urls import path
from .views import (
    IssuesListView, IssueDetailView, IssueCommentsView,
    IssueCloseView, IssueReopenView
)

urlpatterns = [
    path('issues/', IssuesListView.as_view(), name='issues-list'),
    path('issues', IssuesListView.as_view(), name='issues-list-noslash'),
    path('issues/<str:issue_id>/', IssueDetailView.as_view(), name='issue-detail'),
    path('issues/<str:issue_id>', IssueDetailView.as_view(), name='issue-detail-noslash'),
    path('issues/<str:issue_id>/comments/', IssueCommentsView.as_view(), name='issue-comments'),
    path('issues/<str:issue_id>/comments', IssueCommentsView.as_view(), name='issue-comments-noslash'),
    path('issues/<str:issue_id>/close/', IssueCloseView.as_view(), name='issue-close'),
    path('issues/<str:issue_id>/close', IssueCloseView.as_view(), name='issue-close-noslash'),
    path('issues/<str:issue_id>/reopen/', IssueReopenView.as_view(), name='issue-reopen'),
    path('issues/<str:issue_id>/reopen', IssueReopenView.as_view(), name='issue-reopen-noslash'),
]
