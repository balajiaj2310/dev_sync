import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.issues.models import Issue, IssueComment
from apps.pulls.models import PRComment, PRReview, PullRequest
from apps.repositories.models import Branch, Collaborator, FileBlob, Repository


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def seeded_users(db):
    alice = User.objects.create(username="alice", email="alice@devsync.dev")
    alice.set_password("AliceSecure123!")
    alice.save()

    bob = User.objects.create(username="bob", email="bob@devsync.dev")
    bob.set_password("BobSecure123!")
    bob.save()

    return alice, bob


@pytest.fixture
def sample_repo(seeded_users):
    alice, bob = seeded_users
    repo = Repository.objects.create(
        name="test-repo",
        slug="test-repo",
        owner=alice,
        description="A test repository",
        visibility="public",
        default_branch="main",
    )
    main_br = Branch.objects.create(repository=repo, name="main", is_default=True)
    Branch.objects.create(repository=repo, name="feature")
    Collaborator.objects.create(repository=repo, user=alice, role="Admin")
    Collaborator.objects.create(repository=repo, user=bob, role="Contributor")
    return repo


@pytest.mark.django_db
class TestRepositoriesAPI:
    def test_list_repositories(self, api_client, sample_repo):
        res = api_client.get("/api/v1/repositories/")
        assert res.status_code == 200
        assert isinstance(res.data, list)
        assert len(res.data) >= 1
        assert res.data[0]["name"] == sample_repo.name

    def test_create_repository(self, api_client, seeded_users):
        alice, _ = seeded_users
        api_client.force_authenticate(user=alice)
        res = api_client.post(
            "/api/v1/repositories/",
            {
                "name": "new-project",
                "description": "Created via API",
                "visibility": "public",
            },
            format="json",
        )
        assert res.status_code == 201
        assert res.data["name"] == "new-project"
        assert Repository.objects.filter(name="new-project").exists()

    def test_branch_management(self, api_client, sample_repo):
        # List branches
        res = api_client.get(f"/api/v1/repositories/{sample_repo.name}/branches/")
        assert res.status_code == 200
        branch_names = [b["name"] for b in res.data]
        assert "main" in branch_names
        assert "feature" in branch_names

        # Create branch
        res_post = api_client.post(
            f"/api/v1/repositories/{sample_repo.name}/branches/",
            {"name": "bugfix/patch-1"},
            format="json",
        )
        assert res_post.status_code == 201
        assert sample_repo.branches.filter(name="bugfix/patch-1").exists()

    def test_file_upload_and_path_sanitization(self, api_client, sample_repo):
        # Path traversal should be sanitized
        res = api_client.post(
            f"/api/v1/repositories/{sample_repo.name}/upload/",
            {
                "path": "../../etc/passwd/safe.py",
                "content": 'print("hello safe world")',
                "branch": "main",
            },
            format="json",
        )
        assert res.status_code in (200, 201)
        blob = FileBlob.objects.get(repository=sample_repo, branch__name="main")
        assert blob.path == "etc/passwd/safe.py"
        assert blob.content == 'print("hello safe world")'

    def test_collaborator_management(self, api_client, sample_repo, seeded_users):
        alice, bob = seeded_users
        # List members
        res = api_client.get(f"/api/v1/repositories/{sample_repo.name}/members/")
        assert res.status_code == 200
        usernames = [m["username"] for m in res.data]
        assert "alice" in usernames
        assert "bob" in usernames

        # Update member role
        res_patch = api_client.patch(
            f"/api/v1/repositories/{sample_repo.name}/members/{bob.username}/",
            {"role": "Maintainer"},
            format="json",
        )
        assert res_patch.status_code == 200
        collab = sample_repo.collaborators.get(user=bob)
        assert collab.role == "Maintainer"

        # Remove member
        res_del = api_client.delete(
            f"/api/v1/repositories/{sample_repo.name}/members/{bob.username}/"
        )
        assert res_del.status_code == 200
        assert not sample_repo.collaborators.filter(user=bob).exists()


@pytest.mark.django_db
class TestPullRequestsAPI:
    def test_pr_workflow(self, api_client, sample_repo, seeded_users):
        alice, bob = seeded_users
        api_client.force_authenticate(user=bob)

        # 1. Create PR
        res = api_client.post(
            "/api/v1/pull-requests/",
            {
                "title": "Feature: Authentication middleware",
                "description": "Validates incoming bearer sessions",
                "repository": sample_repo.name,
                "sourceBranch": "feature",
                "targetBranch": "main",
            },
            format="json",
        )
        assert res.status_code == 201
        pr_number = res.data["number"]
        assert pr_number is not None

        # 2. Get PR details
        res_get = api_client.get(f"/api/v1/pull-requests/{pr_number}/")
        assert res_get.status_code == 200
        assert res_get.data["number"] == pr_number
        assert res_get.data["status"] == "Open"

        # 3. Add review approval
        api_client.force_authenticate(user=alice)
        res_rev = api_client.post(
            f"/api/v1/pull-requests/{pr_number}/review/",
            {"action": "approve", "comment": "Looks great to me!"},
            format="json",
        )
        assert res_rev.status_code == 200

        # 4. Merge PR
        res_merge = api_client.post(
            f"/api/v1/pull-requests/{pr_number}/merge", {}, format="json"
        )
        assert res_merge.status_code == 200
        assert res_merge.data["status"] == "Merged"

        # Verify merged state in DB
        pr = PullRequest.objects.get(repository=sample_repo, number=pr_number)
        assert pr.status == "Merged"
        assert pr.merged_at is not None

        # Repeat merge should be rejected
        res_repeat = api_client.post(
            f"/api/v1/pull-requests/{pr_number}/merge", {}, format="json"
        )
        assert res_repeat.status_code == 400


@pytest.mark.django_db
class TestIssuesAPI:
    def test_issue_lifecycle(self, api_client, sample_repo, seeded_users):
        alice, bob = seeded_users
        api_client.force_authenticate(user=alice)

        # 1. Create issue
        res = api_client.post(
            "/api/v1/issues/",
            {
                "title": "Investigate cache stampede in Redis session store",
                "description": "Session token lookup needs probabilistic early expiration",
                "repository": sample_repo.name,
            },
            format="json",
        )
        assert res.status_code == 201
        issue_number = res.data["number"]

        # 2. Get issue details
        res_get = api_client.get(f"/api/v1/issues/{issue_number}/")
        assert res_get.status_code == 200
        assert res_get.data["number"] == issue_number
        assert res_get.data["status"] == "Open"

        # 3. Add comment
        res_comm = api_client.post(
            f"/api/v1/issues/{issue_number}/comments/",
            {"text": "Replicated with 500 concurrent workers. Fix is incoming."},
            format="json",
        )
        assert res_comm.status_code == 201

        # 4. Close issue
        res_close = api_client.post(
            f"/api/v1/issues/{issue_number}/close/", {}, format="json"
        )
        assert res_close.status_code == 200
        assert res_close.data["status"] == "Closed"

        # 5. Reopen issue
        res_reopen = api_client.post(
            f"/api/v1/issues/{issue_number}/reopen/", {}, format="json"
        )
        assert res_reopen.status_code == 200
        assert res_reopen.data["status"] == "Open"
