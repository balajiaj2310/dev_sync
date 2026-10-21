from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from .intelligence import calculate_contribution_intelligence


class DeveloperContributionIntelligenceView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, username):
        range_type = request.query_params.get('range', '30d')
        project = request.query_params.get('project', 'all')
        caller = request.user.username if request.user and request.user.is_authenticated else None
        data = calculate_contribution_intelligence(
            username=username,
            range_type=range_type,
            project_filter=project,
            caller_username=caller
        )
        return Response(data)


class AnalyticsContributionIntelligenceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        range_type = request.query_params.get('range', '30d')
        project = request.query_params.get('project', 'all')
        caller = request.user.username
        data = calculate_contribution_intelligence(
            username=caller,
            range_type=range_type,
            project_filter=project,
            caller_username=caller
        )
        return Response(data)


class DeveloperPulseView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, username):
        range_type = request.query_params.get('range', '7d')
        points = [
            {'day': 'Mon', 'commits': 4, 'prs': 1, 'reviews': 2},
            {'day': 'Tue', 'commits': 6, 'prs': 2, 'reviews': 1},
            {'day': 'Wed', 'commits': 3, 'prs': 0, 'reviews': 3},
            {'day': 'Thu', 'commits': 8, 'prs': 1, 'reviews': 2},
            {'day': 'Fri', 'commits': 5, 'prs': 2, 'reviews': 4},
            {'day': 'Sat', 'commits': 2, 'prs': 0, 'reviews': 1},
            {'day': 'Sun', 'commits': 1, 'prs': 0, 'reviews': 0},
        ]
        return Response({
            'username': username,
            'range': range_type,
            'points': points
        })
