from rest_framework import serializers
from .models import Repository, Branch, Commit, FileBlob, Attachment, Collaborator, Star, Fork


class CollaboratorSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    name = serializers.CharField(source='user.full_name', read_only=True)
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = Collaborator
        fields = ['id', 'username', 'name', 'role', 'avatar']

    def get_avatar(self, obj):
        profile = getattr(obj.user, 'profile', None)
        if profile and profile.avatar:
            return profile.avatar.url
        return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ['id', 'name', 'is_default', 'created_at']


class CommitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Commit
        fields = ['id', 'sha', 'message', 'author_name', 'created_at']


class FileBlobSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True)

    class Meta:
        model = FileBlob
        fields = ['id', 'path', 'size', 'mime_type', 'content', 'branch_name', 'updated_at']


class AttachmentSerializer(serializers.ModelSerializer):
    uploader_name = serializers.CharField(source='uploader.username', read_only=True)

    class Meta:
        model = Attachment
        fields = ['id', 'filename', 'file_size', 'file_type', 'uploader_name', 'created_at']


class RepositorySerializer(serializers.ModelSerializer):
    owner_username = serializers.CharField(source='owner.username', read_only=True)
    branches = serializers.SerializerMethodField()
    relationship = serializers.SerializerMethodField()

    class Meta:
        model = Repository
        fields = [
            'id', 'name', 'slug', 'description', 'visibility',
            'default_branch', 'stars_count', 'forks_count', 'icon_bg',
            'tags', 'owner_username', 'branches', 'relationship',
            'created_at', 'updated_at'
        ]

    def get_branches(self, obj):
        return list(obj.branches.values_list('name', flat=True))

    def get_relationship(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return 'Visitor'
        if obj.owner == request.user:
            return 'Owner'
        collab = obj.collaborators.filter(user=request.user).first()
        return collab.role if collab else 'Visitor'
