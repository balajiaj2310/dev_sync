import secrets
import uuid

from django.db import transaction
from django.db.models import Q
from django.utils.text import slugify
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User

from .models import Attachment, Branch, Collaborator, Commit, FileBlob, Repository
from .serializers import (
    AttachmentSerializer,
    BranchSerializer,
    CollaboratorSerializer,
    CommitSerializer,
    FileBlobSerializer,
    RepositorySerializer,
)


def get_repository_or_404(repo_id_or_slug, user=None):
    qs = Repository.objects.all()
    # Check UUID or name or slug
    repo = None
    try:
        val = uuid.UUID(str(repo_id_or_slug))
        repo = qs.filter(id=val).first()
    except (ValueError, AttributeError):
        pass

    if not repo:
        repo = qs.filter(Q(slug=repo_id_or_slug) | Q(name=repo_id_or_slug)).first()

    return repo


class RepositoriesListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        user = request.user if request.user and request.user.is_authenticated else None

        if user:
            # Authenticated user sees all public repos + their owned / collaborating repos
            repos = Repository.objects.filter(
                Q(visibility="public") | Q(owner=user) | Q(collaborators__user=user)
            ).distinct()
        else:
            repos = Repository.objects.filter(visibility="public")

        serializer = RepositorySerializer(
            repos, many=True, context={"request": request}
        )
        return Response(serializer.data)

    def post(self, request):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {"error": "Authentication required", "code": "UNAUTHORIZED"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        user = request.user

        name = request.data.get("name", "").strip()
        if not name:
            return Response(
                {"error": "Repository name is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        description = request.data.get("description", "").strip()
        visibility = request.data.get("visibility", "public").lower()
        default_branch = request.data.get("default_branch", "main").strip()
        icon_bg = request.data.get("iconBg", request.data.get("icon_bg", "#10B981"))

        with transaction.atomic():
            repo, created = Repository.objects.get_or_create(
                owner=user,
                name=name,
                defaults={
                    "slug": slugify(name),
                    "description": description,
                    "visibility": visibility,
                    "default_branch": default_branch,
                    "icon_bg": icon_bg,
                },
            )
            # Create default branch
            Branch.objects.get_or_create(
                repository=repo,
                name=default_branch,
                defaults={"is_default": True, "created_by": user},
            )
            # Add owner as admin collaborator
            Collaborator.objects.get_or_create(
                repository=repo, user=user, defaults={"role": "Admin"}
            )

        serializer = RepositorySerializer(repo, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class RepositoryDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, repo_id):
        repo = get_repository_or_404(repo_id, request.user)
        if not repo:
            return Response(
                {"error": "Repository not found"}, status=status.HTTP_404_NOT_FOUND
            )
        serializer = RepositorySerializer(repo, context={"request": request})
        return Response(serializer.data)


class RepositoryBranchesView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, repo_id):
        repo = get_repository_or_404(repo_id, request.user)
        if not repo:
            return Response(
                {"error": "Repository not found"}, status=status.HTTP_404_NOT_FOUND
            )
        branches = repo.branches.all()
        serializer = BranchSerializer(branches, many=True)
        return Response(serializer.data)

    def post(self, request, repo_id):
        repo = get_repository_or_404(repo_id, request.user)
        if not repo:
            return Response(
                {"error": "Repository not found"}, status=status.HTTP_404_NOT_FOUND
            )

        branch_name = request.data.get("name", "").strip()
        if not branch_name:
            return Response(
                {"error": "Branch name is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        branch, created = Branch.objects.get_or_create(
            repository=repo,
            name=branch_name,
            defaults={
                "created_by": request.user if request.user.is_authenticated else None
            },
        )
        serializer = BranchSerializer(branch)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class RepositoryFilesView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, repo_id):
        repo = get_repository_or_404(repo_id, request.user)
        if not repo:
            return Response(
                {"error": "Repository not found"}, status=status.HTTP_404_NOT_FOUND
            )

        branch_name = request.query_params.get("branch", repo.default_branch)
        branch = repo.branches.filter(name=branch_name).first()
        if not branch:
            files = []
        else:
            files = repo.file_blobs.filter(branch=branch)

        serializer = FileBlobSerializer(files, many=True)
        return Response(serializer.data)


class RepositoryFileContentView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, repo_id):
        repo = get_repository_or_404(repo_id, request.user)
        if not repo:
            return Response(
                {"error": "Repository not found"}, status=status.HTTP_404_NOT_FOUND
            )

        raw_path = request.query_params.get("path", "").strip()
        clean_path = FileBlob.sanitize_path(raw_path)
        branch_name = request.query_params.get("branch", repo.default_branch)

        branch = repo.branches.filter(name=branch_name).first()
        if not branch:
            return Response(
                {"error": "Branch not found"}, status=status.HTTP_404_NOT_FOUND
            )

        blob = repo.file_blobs.filter(branch=branch, path=clean_path).first()
        if not blob:
            return Response(
                {"error": "File not found"}, status=status.HTTP_404_NOT_FOUND
            )

        serializer = FileBlobSerializer(blob)
        return Response(serializer.data)


class RepositoryFileUploadView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, repo_id):
        repo = get_repository_or_404(repo_id, request.user)
        if not repo:
            return Response(
                {"error": "Repository not found"}, status=status.HTTP_404_NOT_FOUND
            )

        raw_path = request.data.get("path", "").strip()
        clean_path = FileBlob.sanitize_path(raw_path)
        if not clean_path:
            return Response(
                {"error": "Valid file path is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        content = request.data.get("content", "")
        branch_name = request.data.get("branch", repo.default_branch)
        branch, _ = repo.branches.get_or_create(repository=repo, name=branch_name)

        blob, created = FileBlob.objects.update_or_create(
            repository=repo,
            branch=branch,
            path=clean_path,
            defaults={
                "content": content,
                "size": len(content.encode("utf-8")),
                "mime_type": "text/plain",
            },
        )

        # Record commit
        user = request.user if request.user.is_authenticated else None
        Commit.objects.create(
            repository=repo,
            branch=branch,
            sha=secrets.token_hex(20),
            message=request.data.get("message", f"Update {clean_path}"),
            author=user,
            author_name=user.username if user else "Anonymous",
        )

        return Response(
            FileBlobSerializer(blob).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class RepositoryAttachmentsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, repo_id):
        repo = get_repository_or_404(repo_id, request.user)
        if not repo:
            return Response(
                {"error": "Repository not found"}, status=status.HTTP_404_NOT_FOUND
            )
        attachments = repo.attachments.all()
        return Response(AttachmentSerializer(attachments, many=True).data)

    def post(self, request, repo_id):
        repo = get_repository_or_404(repo_id, request.user)
        if not repo:
            return Response(
                {"error": "Repository not found"}, status=status.HTTP_404_NOT_FOUND
            )

        filename = request.data.get("filename", "unnamed_file")
        file_size = request.data.get("size", 0)
        file_type = request.data.get("type", "application/octet-stream")

        user = request.user if request.user.is_authenticated else None
        att = Attachment.objects.create(
            repository=repo,
            uploader=user,
            filename=filename,
            file_size=file_size,
            file_type=file_type,
        )
        return Response(AttachmentSerializer(att).data, status=status.HTTP_201_CREATED)


class RepositoryMembersView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, repo_id):
        repo = get_repository_or_404(repo_id, request.user)
        if not repo:
            return Response(
                {"error": "Repository not found"}, status=status.HTTP_404_NOT_FOUND
            )
        members = repo.collaborators.all()
        return Response(CollaboratorSerializer(members, many=True).data)

    def post(self, request, repo_id):
        repo = get_repository_or_404(repo_id, request.user)
        if not repo:
            return Response(
                {"error": "Repository not found"}, status=status.HTTP_404_NOT_FOUND
            )

        username = request.data.get("username", "").strip()
        role = request.data.get("role", "Contributor").strip()
        user = User.objects.filter(username__iexact=username).first()
        if not user:
            return Response(
                {"error": f"User {username} not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        collab, created = Collaborator.objects.update_or_create(
            repository=repo, user=user, defaults={"role": role}
        )
        return Response(
            CollaboratorSerializer(collab).data, status=status.HTTP_201_CREATED
        )


class RepositoryMemberDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def patch(self, request, repo_id, username):
        repo = get_repository_or_404(repo_id, request.user)
        if not repo:
            return Response(
                {"error": "Repository not found"}, status=status.HTTP_404_NOT_FOUND
            )

        user = User.objects.filter(username__iexact=username).first()
        if not user:
            return Response(
                {"error": f"User {username} not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        collab = repo.collaborators.filter(user=user).first()
        if not collab:
            return Response(
                {"error": "Collaborator not found"}, status=status.HTTP_404_NOT_FOUND
            )

        new_role = request.data.get("role")
        if new_role:
            collab.role = new_role
            collab.save(update_fields=["role"])

        return Response(CollaboratorSerializer(collab).data)

    def delete(self, request, repo_id, username):
        repo = get_repository_or_404(repo_id, request.user)
        if not repo:
            return Response(
                {"error": "Repository not found"}, status=status.HTTP_404_NOT_FOUND
            )

        user = User.objects.filter(username__iexact=username).first()
        if not user:
            return Response(
                {"error": f"User {username} not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        repo.collaborators.filter(user=user).delete()
        return Response({"success": True, "message": f"Member {username} removed"})


class RepositoryActivityView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, repo_id):
        repo = get_repository_or_404(repo_id, request.user)
        if not repo:
            return Response(
                {"error": "Repository not found"}, status=status.HTTP_404_NOT_FOUND
            )

        commits = repo.commits.all()[:20]
        return Response(CommitSerializer(commits, many=True).data)

from django.http import HttpResponse
import backend_workspace
import backend_execution


class WorkspaceInfoView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, repo_id):
        user = request.user if request.user and request.user.is_authenticated else None
        auth_user = {'username': user.username} if user else None
        ok, data, code = backend_workspace.get_workspace_info(repo_id, auth_user=auth_user)
        return Response(data, status=code)


class WorkspaceTreeView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, repo_id):
        branch = request.GET.get('branch')
        user = request.user if request.user and request.user.is_authenticated else None
        auth_user = {'username': user.username} if user else None
        ok, data, code = backend_workspace.get_workspace_tree(repo_id, branch=branch, auth_user=auth_user)
        return Response(data, status=code)


class WorkspaceFileView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, repo_id):
        branch = request.GET.get('branch')
        path = request.GET.get('path', request.GET.get('file', ''))
        user = request.user if request.user and request.user.is_authenticated else None
        auth_user = {'username': user.username} if user else None
        ok, data, code = backend_workspace.get_workspace_file(repo_id, branch, path, auth_user=auth_user)
        return Response(data, status=code)

    def post(self, request, repo_id):
        branch = request.data.get('branch')
        path = request.data.get('path', request.data.get('filePath', ''))
        content = request.data.get('content', '')
        commit_msg = request.data.get('commitMessage', request.data.get('message', ''))
        user = request.user if request.user and request.user.is_authenticated else None
        auth_user = {'username': user.username} if user else None
        ok, data, code = backend_workspace.save_workspace_file(
            repo_id, branch, path, content, commit_message=commit_msg, auth_user=auth_user
        )
        return Response(data, status=code)

    def put(self, request, repo_id):
        return self.post(request, repo_id)

    def delete(self, request, repo_id):
        branch = request.GET.get('branch', request.data.get('branch'))
        path = request.GET.get('path', request.data.get('path', request.data.get('filePath', '')))
        commit_msg = request.GET.get('message', request.data.get('commitMessage', request.data.get('message', '')))
        user = request.user if request.user and request.user.is_authenticated else None
        auth_user = {'username': user.username} if user else None
        ok, data, code = backend_workspace.delete_workspace_path(
            repo_id, branch, path, commit_message=commit_msg, auth_user=auth_user
        )
        return Response(data, status=code)


class WorkspaceFilesCreateView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, repo_id):
        branch = request.data.get('branch')
        path = request.data.get('path', request.data.get('filePath', ''))
        item_type = request.data.get('type', 'file')
        content = request.data.get('content', '')
        commit_msg = request.data.get('commitMessage', request.data.get('message', ''))
        user = request.user if request.user and request.user.is_authenticated else None
        auth_user = {'username': user.username} if user else None
        ok, data, code = backend_workspace.create_workspace_file_or_folder(
            repo_id, branch, path, item_type=item_type, initial_content=content,
            commit_message=commit_msg, auth_user=auth_user
        )
        return Response(data, status=code)


class WorkspaceFilesRenameView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, repo_id):
        branch = request.data.get('branch')
        old_path = request.data.get('oldPath', request.data.get('old_path', ''))
        new_path = request.data.get('newPath', request.data.get('new_path', ''))
        commit_msg = request.data.get('commitMessage', request.data.get('message', ''))
        user = request.user if request.user and request.user.is_authenticated else None
        auth_user = {'username': user.username} if user else None
        ok, data, code = backend_workspace.rename_workspace_path(
            repo_id, branch, old_path, new_path, commit_message=commit_msg, auth_user=auth_user
        )
        return Response(data, status=code)


class WorkspaceArchiveView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, repo_id):
        branch = request.GET.get('branch')
        user = request.user if request.user and request.user.is_authenticated else None
        auth_user = {'username': user.username} if user else None
        ok, data, filename, code = backend_workspace.create_workspace_zip_archive(repo_id, branch, auth_user=auth_user)
        if not ok:
            return Response(data, status=code)
        response = HttpResponse(data, content_type='application/zip')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class WorkspaceExecuteView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, repo_id):
        branch = request.data.get('branch')
        file_path = request.data.get('filePath', request.data.get('path', ''))
        source_code = request.data.get('sourceCode', request.data.get('source_code', request.data.get('content', '')))
        language = request.data.get('language')
        stdin = request.data.get('stdin', '')
        args = request.data.get('args', [])
        provider_name = request.data.get('provider')
        user = request.user if request.user and request.user.is_authenticated else None
        auth_user = {'username': user.username} if user else None
        ok, data, code = backend_workspace.execute_workspace_code(
            repo_id, branch, file_path, source_code, language=language,
            stdin=stdin, args=args, auth_user=auth_user, provider_name=provider_name
        )
        return Response(data, status=code)


class WorkspaceHistoryView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, repo_id):
        try:
            limit = int(request.GET.get('limit', 20))
        except ValueError:
            limit = 20
        user = request.user if request.user and request.user.is_authenticated else None
        auth_user = {'username': user.username} if user else None
        ok, data, code = backend_workspace.get_workspace_execution_history(repo_id, limit=limit, auth_user=auth_user)
        return Response(data, status=code)


class WorkspaceGitStatusView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, repo_id):
        branch = request.GET.get('branch')
        user = request.user if request.user and request.user.is_authenticated else None
        auth_user = {'username': user.username} if user else None
        ok, data, code = backend_workspace.get_workspace_git_status(repo_id, branch=branch, auth_user=auth_user)
        return Response(data, status=code)


class WorkspaceGitCommitView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, repo_id):
        branch = request.data.get('branch')
        message = request.data.get('message', request.data.get('commitMessage', ''))
        files = request.data.get('files', [])
        user = request.user if request.user and request.user.is_authenticated else None
        auth_user = {'username': user.username} if user else None
        ok, data, code = backend_workspace.commit_workspace_changes(
            repo_id, branch, message, files=files, auth_user=auth_user
        )
        return Response(data, status=code)


class WorkspaceIdeConfigView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, repo_id):
        branch = request.GET.get('branch')
        user = request.user if request.user and request.user.is_authenticated else None
        auth_user = {'username': user.username} if user else None
        host_url = request.build_absolute_uri('/')[:-1]
        ok, data, code = backend_workspace.get_external_ide_config(
            repo_id, branch, host_url=host_url, auth_user=auth_user
        )
        return Response(data, status=code)
