import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.analytics.intelligence import calculate_contribution_intelligence
from apps.analytics.models import ActivityEvent
from apps.notifications.models import Notification
from apps.teams.models import Invitation, Membership, Team


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def phase3_data(db):
    user = User.objects.create(username="naveen3438", email="naveen@devsync.dev")
    user.set_password("SecurePass123!")
    user.save()

    peer = User.objects.create(username="balajikumar", email="balaji@devsync.dev")
    peer.set_password("SecurePass123!")
    peer.save()

    team = Team.objects.create(
        name="DevSync Core Team", slug="devsync-core", created_by=user
    )
    m1 = Membership.objects.create(
        team=team, user=user, role="Lead Maintainer", project="devsync-core"
    )
    m2 = Membership.objects.create(
        team=team, user=peer, role="Core Contributor", project="devsync-core"
    )

    # Notifications across all 6 categories
    cats = ["repository", "pull_request", "issue", "mention", "team", "connection"]
    for c in cats:
        Notification.objects.create(
            recipient=user,
            category=c,
            title=f"Test {c} notification",
            description=f"Notification description for {c}",
            actor_username="balajikumar",
            unread=True,
        )

    # Activity events for intelligence calculation
    for i in range(5):
        ActivityEvent.objects.create(
            user=user,
            event_type="git_commit",
            repository="devsync-core",
            title=f"Commit #{i}",
        )

    return user, peer, team


@pytest.mark.django_db
class TestTeamsAPI:
    def test_list_teams(self, api_client, phase3_data):
        res = api_client.get("/api/v1/teams/")
        assert res.status_code == 200
        assert isinstance(res.data, list)
        assert len(res.data) >= 1
        assert res.data[0]["name"] == "DevSync Core Team"

    def test_list_team_members_with_filtering(self, api_client, phase3_data):
        res = api_client.get("/api/v1/teams/members/?project=devsync-core")
        assert res.status_code == 200
        assert isinstance(res.data, list)
        assert len(res.data) >= 2

        # Role filter
        res_role = api_client.get("/api/v1/teams/members/?role=Lead Maintainer")
        assert res_role.status_code == 200
        assert any(m["username"] == "naveen3438" for m in res_role.data)

    def test_invite_member(self, api_client, phase3_data):
        res = api_client.post(
            "/api/v1/teams/members/invite/",
            {
                "email": "newengineer@devsync.dev",
                "name": "New Engineer",
                "role": "Fullstack Developer",
                "project": "devsync-core",
            },
            format="json",
        )
        assert res.status_code == 201
        assert Invitation.objects.filter(email="newengineer@devsync.dev").exists()

    def test_update_member_role(self, api_client, phase3_data):
        res = api_client.patch(
            "/api/v1/teams/members/balajikumar/",
            {"role": "Lead Architect"},
            format="json",
        )
        assert res.status_code == 200
        assert res.data["role"] == "Lead Architect"
        m = Membership.objects.get(user__username="balajikumar")
        assert m.role == "Lead Architect"


@pytest.mark.django_db
class TestNotificationsAPI:
    def test_list_notifications_and_summary(self, api_client, phase3_data):
        user, _, _ = phase3_data
        api_client.force_authenticate(user=user)

        res = api_client.get("/api/v1/notifications/")
        assert res.status_code == 200
        assert "notifications" in res.data
        assert "summary" in res.data
        notifications = res.data["notifications"]
        assert len(notifications) >= 6

        # Check all 6 categories present
        cats = set(n["category"] for n in notifications)
        assert {
            "repository",
            "pull_request",
            "issue",
            "mention",
            "team",
            "connection",
        }.issubset(cats)

    def test_mark_read_and_unread(self, api_client, phase3_data):
        user, _, _ = phase3_data
        api_client.force_authenticate(user=user)

        notif = Notification.objects.filter(recipient=user).first()

        # Mark as read
        res_read = api_client.post(
            "/api/v1/notifications/mark-read/", {"id": str(notif.id)}, format="json"
        )
        assert res_read.status_code == 200
        notif.refresh_from_db()
        assert notif.unread is False

        # Mark as unread
        res_unread = api_client.post(
            "/api/v1/notifications/mark-unread/", {"id": str(notif.id)}, format="json"
        )
        assert res_unread.status_code == 200
        notif.refresh_from_db()
        assert notif.unread is True

        # Mark all as read
        res_all = api_client.post(
            "/api/v1/notifications/mark-read/", {"all": True}, format="json"
        )
        assert res_all.status_code == 200
        assert res_all.data["summary"]["unread"] == 0

    def test_connection_action(self, api_client, phase3_data):
        user, _, _ = phase3_data
        api_client.force_authenticate(user=user)

        conn_notif = Notification.objects.filter(
            recipient=user, category="connection"
        ).first()
        res = api_client.post(
            "/api/v1/notifications/connection-action/",
            {"notification_id": str(conn_notif.id), "action": "accept"},
            format="json",
        )
        assert res.status_code == 200
        assert res.data["success"] is True
        assert res.data["action"] == "accept"

    def test_delete_notification(self, api_client, phase3_data):
        user, _, _ = phase3_data
        api_client.force_authenticate(user=user)

        target = Notification.objects.filter(recipient=user).first()
        target_id = str(target.id)

        res = api_client.delete(f"/api/v1/notifications/{target_id}/")
        assert res.status_code == 200
        assert res.data["success"] is True
        assert not Notification.objects.filter(id=target_id).exists()


@pytest.mark.django_db
class TestContributionIntelligenceAPI:
    def test_active_user_intelligence(self, api_client, phase3_data):
        res = api_client.get(
            "/api/v1/developers/naveen3438/contribution-intelligence?range=30d"
        )
        assert res.status_code == 200
        assert res.data["hasSufficientData"] is True
        assert res.data["status"] == "calculated"
        assert 0 <= res.data["score"] <= 100

        # Check 3 indicators
        ind = res.data["indicators"]
        assert "impact" in ind
        assert "flow" in ind
        assert "collaboration" in ind
        assert "delivered" in ind["impact"]["value"].lower()
        assert "resolved" in ind["flow"]["value"].lower()
        assert "interactions" in ind["collaboration"]["value"].lower()

        # Check 5 strengths
        strengths = res.data["strengths"]
        assert len(strengths) == 5

        # Check project distribution
        pdist = res.data["projectDistribution"]
        assert isinstance(pdist, list)
        assert len(pdist) >= 1

    def test_inactive_user_insufficient_data(self, api_client):
        res = api_client.get(
            "/api/v1/developers/nonexistent_or_inactive_dev/contribution-intelligence"
        )
        assert res.status_code == 200
        assert res.data["hasSufficientData"] is False
        assert res.data["score"] is None
        assert res.data["status"] == "insufficient_data"

    def test_developer_pulse_endpoint(self, api_client):
        res = api_client.get("/api/v1/developers/naveen3438/pulse?range=7d")
        assert res.status_code == 200
        assert res.data["range"] == "7d"
        assert len(res.data["points"]) == 7
