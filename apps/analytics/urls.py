from django.urls import path

from .views import (
    AnalyticsContributionIntelligenceView,
    DeveloperContributionIntelligenceView,
    DeveloperPulseView,
)

urlpatterns = [
    path(
        "developers/<str:username>/contribution-intelligence/",
        DeveloperContributionIntelligenceView.as_view(),
        name="dev-contribution-intelligence",
    ),
    path(
        "developers/<str:username>/contribution-intelligence",
        DeveloperContributionIntelligenceView.as_view(),
        name="dev-contribution-intelligence-noslash",
    ),
    path(
        "analytics/contribution-intelligence/",
        AnalyticsContributionIntelligenceView.as_view(),
        name="analytics-contribution-intelligence",
    ),
    path(
        "analytics/contribution-intelligence",
        AnalyticsContributionIntelligenceView.as_view(),
        name="analytics-contribution-intelligence-noslash",
    ),
    path(
        "developers/<str:username>/pulse/",
        DeveloperPulseView.as_view(),
        name="dev-pulse",
    ),
    path(
        "developers/<str:username>/pulse",
        DeveloperPulseView.as_view(),
        name="dev-pulse-noslash",
    ),
]
