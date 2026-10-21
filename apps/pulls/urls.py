from django.urls import path
from .views import (
    PullRequestsListView, PullRequestDetailView, PullRequestReviewView,
    PullRequestMergeView, PullRequestCommentsView
)

urlpatterns = [
    path('pull-requests/', PullRequestsListView.as_view(), name='pull-requests-list'),
    path('pull-requests', PullRequestsListView.as_view(), name='pull-requests-list-noslash'),
    path('pull-requests/<str:pr_id>/', PullRequestDetailView.as_view(), name='pull-request-detail'),
    path('pull-requests/<str:pr_id>', PullRequestDetailView.as_view(), name='pull-request-detail-noslash'),
    path('pull-requests/<str:pr_id>/review/', PullRequestReviewView.as_view(), name='pull-request-review'),
    path('pull-requests/<str:pr_id>/review', PullRequestReviewView.as_view(), name='pull-request-review-noslash'),
    path('pull-requests/<str:pr_id>/merge/', PullRequestMergeView.as_view(), name='pull-request-merge'),
    path('pull-requests/<str:pr_id>/merge', PullRequestMergeView.as_view(), name='pull-request-merge-noslash'),
    path('pull-requests/<str:pr_id>/comments/', PullRequestCommentsView.as_view(), name='pull-request-comments'),
    path('pull-requests/<str:pr_id>/comments', PullRequestCommentsView.as_view(), name='pull-request-comments-noslash'),
]
