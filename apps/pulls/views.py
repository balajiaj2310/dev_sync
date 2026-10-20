from django.db import transaction
from django.db.models import Max, Q
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.repositories.models import Branch, Commit, FileBlob, Repository

from .models import PRComment, PRReview, PullRequest
from .serializers import PRCommentSerializer, PRReviewSerializer, PullRequestSerializer


class PullRequestsListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        qs = PullRequest.objects.all().select_related("repository", "author")

        repo_query = request.query_params.get("repository")
        if repo_query:
            qs = qs.filter(
                Q(repository__name__iexact=repo_query)
                | Q(repository__slug__iexact=repo_query)
            )

        status_query = request.query_params.get("status")
        if status_query:
            qs = qs.filter(status__iexact=status_query)

        author_query = request.query_params.get("author")
        if author_query:
            qs = qs.filter(author__username__iexact=author_query)

        search_query = request.query_params.get("search")
        if search_query:
            qs = qs.filter(
                Q(title__icontains=search_query)
                | Q(description__icontains=search_query)
            )

        serializer = PullRequestSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {"error": "Authentication required", "code": "UNAUTHORIZED"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        user = request.user

        repo_identifier = request.data.get("repository", "").strip()
        repo = Repository.objects.filter(
            Q(name__iexact=repo_identifier) | Q(slug__iexact=repo_identifier)
        ).first()
        if not repo:
            # Fall back to creating or finding default repository
            repo, _ = Repository.objects.get_or_create(
                name=repo_identifier or "devsync-core",
                owner=user,
                defaults={"slug": repo_identifier or "devsync-core"},
            )

        title = request.data.get("title", "").strip()
        if not title:
            return Response(
                {"error": "PR title is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        description = request.data.get("description", "")
        source_branch = request.data.get(
            "sourceBranch", request.data.get("source_branch", "feature")
        ).strip()
        target_branch = request.data.get(
            "targetBranch", request.data.get("target_branch", "main")
        ).strip()

        with transaction.atomic():
            max_num = (
                PullRequest.objects.filter(repository=repo).aggregate(Max("number"))[
                    "number__max"
                ]
                or 200
            )
            pr_num = max_num + 1

            pr = PullRequest.objects.create(
                repository=repo,
                number=pr_num,
                title=title,
                description=description,
                author=user,
                source_branch=source_branch,
                target_branch=target_branch,
                status="Open",
                changed_files=[
                    {"path": "src/index.ts", "additions": 24, "deletions": 4}
                ],
                additions=24,
                deletions=4,
            )

        serializer = PullRequestSerializer(pr)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PullRequestDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pr_id):
        # pr_id could be number or UUID
        pr = None
        if pr_id.isdigit():
            pr = PullRequest.objects.filter(number=int(pr_id)).first()
        if not pr:
            try:
                pr = PullRequest.objects.filter(id=pr_id).first()
            except Exception:
                pass

        if not pr:
            return Response(
                {"error": f"Pull request {pr_id} not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = PullRequestSerializer(pr)
        return Response(serializer.data)


class PullRequestReviewView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, pr_id):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {"error": "Authentication required", "code": "UNAUTHORIZED"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        reviewer = request.user

        pr = None
        if pr_id.isdigit():
            pr = PullRequest.objects.filter(number=int(pr_id)).first()
        if not pr:
            pr = PullRequest.objects.filter(id=pr_id).first()

        if not pr:
            return Response(
                {"error": f"Pull request {pr_id} not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        action = request.data.get("action", "approve").lower()
        comment = request.data.get("comment", "")

        review = PRReview.objects.create(
            pull_request=pr, reviewer=reviewer, action=action, comment=comment
        )
        if action == "approve":
            pr.status = "Review"
            pr.save(update_fields=["status"])

        return Response(
            {
                "success": True,
                "action": action,
                "review": PRReviewSerializer(review).data,
                "reviews": PRReviewSerializer(pr.reviews.all(), many=True).data,
            },
            status=status.HTTP_200_OK,
        )


class PullRequestMergeView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, pr_id):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {"error": "Authentication required", "code": "UNAUTHORIZED"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        actor = request.user

        pr = None
        if pr_id.isdigit():
            pr = PullRequest.objects.filter(number=int(pr_id)).first()
        if not pr:
            pr = PullRequest.objects.filter(id=pr_id).first()

        if not pr:
            return Response(
                {"error": f"Pull request {pr_id} not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        can_merge, msg = pr.can_merge(actor)
        if not can_merge:
            return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            pr.status = "Merged"
            pr.merged_at = timezone.now()
            pr.merged_by = actor
            pr.save(update_fields=["status", "merged_at", "merged_by"])

            # Merge file blobs from source to target branch if branches exist in repository
            repo = pr.repository
            target_br, _ = Branch.objects.get_or_create(
                repository=repo, name=pr.target_branch
            )
            source_br = Branch.objects.filter(
                repository=repo, name=pr.source_branch
            ).first()
            if source_br:
                for blob in FileBlob.objects.filter(repository=repo, branch=source_br):
                    FileBlob.objects.update_or_create(
                        repository=repo,
                        branch=target_br,
                        path=blob.path,
                        defaults={
                            "content": blob.content,
                            "size": blob.size,
                            "mime_type": blob.mime_type,
                        },
                    )

        return Response(
            {
                "success": True,
                "status": "Merged",
                "message": f"PR #{pr.number} merged into {pr.target_branch} successfully.",
            },
            status=status.HTTP_200_OK,
        )


class PullRequestCommentsView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, pr_id):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {"error": "Authentication required", "code": "UNAUTHORIZED"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        author = request.user

        pr = None
        if pr_id.isdigit():
            pr = PullRequest.objects.filter(number=int(pr_id)).first()
        if not pr:
            pr = PullRequest.objects.filter(id=pr_id).first()

        if not pr:
            return Response(
                {"error": f"Pull request {pr_id} not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        text = request.data.get("text", "").strip()
        if not text:
            return Response(
                {"error": "Comment text is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        comment = PRComment.objects.create(
            pull_request=pr,
            author=author,
            text=text,
            path=request.data.get("path", ""),
            line_number=request.data.get("line_number"),
        )
        return Response(
            PRCommentSerializer(comment).data, status=status.HTTP_201_CREATED
        )
