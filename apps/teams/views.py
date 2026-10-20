from django.db.models import Q
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User

from .models import Invitation, Membership, Team
from .serializers import InvitationSerializer, MemberSerializer, TeamSerializer


class TeamsListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        teams = Team.objects.all()
        return Response(TeamSerializer(teams, many=True).data)


class TeamMembersListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        qs = Membership.objects.all().select_related("team", "user")

        search = request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(user__username__icontains=search)
                | Q(user__first_name__icontains=search)
                | Q(user__last_name__icontains=search)
                | Q(user__email__icontains=search)
            )

        project = request.query_params.get("project")
        if project:
            qs = qs.filter(
                Q(project__icontains=project) | Q(team__name__icontains=project)
            )

        role = request.query_params.get("role")
        if role:
            qs = qs.filter(role__iexact=role)

        return Response(MemberSerializer(qs, many=True).data)


class TeamMemberInviteView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip()
        if not email:
            return Response(
                {"error": "Email is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        name = request.data.get("name", "").strip()
        role = request.data.get("role", "Fullstack Developer").strip()
        project = request.data.get("project", "devsync-core").strip()

        # Find team by project or first team
        team = Team.objects.filter(
            Q(name__icontains=project) | Q(slug__icontains=project)
        ).first()
        if not team:
            team = Team.objects.first()

        invitation = Invitation.create_invitation(
            team=team, email=email, name=name, role=role, project=project
        )

        return Response(
            InvitationSerializer(invitation).data, status=status.HTTP_201_CREATED
        )


class TeamMemberDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def patch(self, request, username):
        user = User.objects.filter(username__iexact=username.strip()).first()
        if not user:
            return Response(
                {"error": f"User {username} not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        role = request.data.get("role")
        project = request.data.get("project")

        membership = Membership.objects.filter(user=user).first()
        if not membership:
            # Create a membership if none exists
            team = Team.objects.first()
            if not team:
                team = Team.objects.create(
                    name="DevSync Core Team", slug="devsync-core"
                )
            membership = Membership.objects.create(
                team=team,
                user=user,
                role=role or "Lead Maintainer",
                project=project or "devsync-core",
            )
        else:
            if role:
                membership.role = role
            if project:
                membership.project = project
            membership.save()

        return Response(MemberSerializer(membership).data, status=status.HTTP_200_OK)
