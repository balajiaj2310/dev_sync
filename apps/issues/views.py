from django.db import transaction
from django.db.models import Max, Q
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions

from apps.accounts.models import User
from apps.repositories.models import Repository
from .models import Issue, IssueComment, Label, Milestone
from .serializers import IssueSerializer, IssueCommentSerializer


def get_actor_user(request):
    if request.user and request.user.is_authenticated:
        return request.user
    dev_header = request.headers.get('X-DevSync-User')
    if dev_header:
        user = User.objects.filter(username__iexact=dev_header.strip()).first()
        if user:
            return user
    return User.objects.filter(username='naveen3438').first()


def find_issue(issue_id):
    if str(issue_id).isdigit():
        issue = Issue.objects.filter(number=int(issue_id)).first()
        if issue:
            return issue
    try:
        return Issue.objects.filter(id=issue_id).first()
    except Exception:
        return None


class IssuesListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        qs = Issue.objects.all().select_related('repository', 'author', 'milestone').prefetch_related('labels', 'comments')

        repo_query = request.query_params.get('repository')
        if repo_query:
            qs = qs.filter(Q(repository__name__iexact=repo_query) | Q(repository__slug__iexact=repo_query))

        status_query = request.query_params.get('status')
        if status_query:
            qs = qs.filter(status__iexact=status_query)

        label_query = request.query_params.get('label')
        if label_query:
            qs = qs.filter(labels__name__iexact=label_query)

        author_query = request.query_params.get('author')
        if author_query:
            qs = qs.filter(author__username__iexact=author_query)

        search_query = request.query_params.get('search')
        if search_query:
            qs = qs.filter(Q(title__icontains=search_query) | Q(description__icontains=search_query))

        serializer = IssueSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        user = get_actor_user(request)
        if not user:
            return Response({"error": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)

        repo_identifier = request.data.get('repository', '').strip()
        repo = Repository.objects.filter(Q(name__iexact=repo_identifier) | Q(slug__iexact=repo_identifier)).first()
        if not repo:
            repo, _ = Repository.objects.get_or_create(
                name=repo_identifier or 'devsync-core',
                owner=user,
                defaults={'slug': repo_identifier or 'devsync-core'}
            )

        title = request.data.get('title', '').strip()
        if not title:
            return Response({"error": "Issue title is required"}, status=status.HTTP_400_BAD_REQUEST)

        description = request.data.get('description', '')

        with transaction.atomic():
            max_num = Issue.objects.filter(repository=repo).aggregate(Max('number'))['number__max'] or 100
            issue_num = max_num + 1

            issue = Issue.objects.create(
                repository=repo,
                number=issue_num,
                title=title,
                description=description,
                author=user,
                status='Open'
            )

        serializer = IssueSerializer(issue)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class IssueDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, issue_id):
        issue = find_issue(issue_id)
        if not issue:
            return Response({"error": f"Issue {issue_id} not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = IssueSerializer(issue)
        return Response(serializer.data)


class IssueCommentsView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, issue_id):
        issue = find_issue(issue_id)
        if not issue:
            return Response({"error": f"Issue {issue_id} not found"}, status=status.HTTP_404_NOT_FOUND)

        user = get_actor_user(request)
        text = request.data.get('text', '').strip()
        if not text:
            return Response({"error": "Comment text is required"}, status=status.HTTP_400_BAD_REQUEST)

        comment = IssueComment.objects.create(
            issue=issue,
            author=user,
            text=text
        )
        return Response({
            "success": True,
            "id": str(comment.id),
            "comment": IssueCommentSerializer(comment).data
        }, status=status.HTTP_201_CREATED)


class IssueCloseView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, issue_id):
        issue = find_issue(issue_id)
        if not issue:
            return Response({"error": f"Issue {issue_id} not found"}, status=status.HTTP_404_NOT_FOUND)

        user = get_actor_user(request)
        issue.status = 'Closed'
        issue.closed_at = timezone.now()
        issue.closed_by = user
        issue.save(update_fields=['status', 'closed_at', 'closed_by'])

        return Response({
            "success": True,
            "status": "Closed",
            "message": f"Issue #{issue.number} closed."
        }, status=status.HTTP_200_OK)


class IssueReopenView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, issue_id):
        issue = find_issue(issue_id)
        if not issue:
            return Response({"error": f"Issue {issue_id} not found"}, status=status.HTTP_404_NOT_FOUND)

        issue.status = 'Open'
        issue.closed_at = None
        issue.closed_by = None
        issue.save(update_fields=['status', 'closed_at', 'closed_by'])

        return Response({
            "success": True,
            "status": "Open",
            "message": f"Issue #{issue.number} reopened."
        }, status=status.HTTP_200_OK)
