from rest_framework import serializers
from .models import PullRequest, PRReview, PRComment


class PRReviewSerializer(serializers.ModelSerializer):
    reviewer_name = serializers.CharField(source='reviewer.username', read_only=True)
    author = serializers.SerializerMethodField()

    class Meta:
        model = PRReview
        fields = ['id', 'action', 'comment', 'reviewer_name', 'author', 'created_at']

    def get_author(self, obj):
        profile = getattr(obj.reviewer, 'profile', None)
        return {
            'username': obj.reviewer.username,
            'name': obj.reviewer.full_name,
            'avatar': profile.avatar.url if profile and profile.avatar else 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'
        }


class PRCommentSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()

    class Meta:
        model = PRComment
        fields = ['id', 'text', 'path', 'line_number', 'author', 'created_at']

    def get_author(self, obj):
        profile = getattr(obj.author, 'profile', None)
        return {
            'username': obj.author.username,
            'name': obj.author.full_name,
            'avatar': profile.avatar.url if profile and profile.avatar else 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'
        }


class PullRequestSerializer(serializers.ModelSerializer):
    repository_name = serializers.CharField(source='repository.name', read_only=True)
    author = serializers.SerializerMethodField()
    reviews = PRReviewSerializer(many=True, read_only=True)
    comments = PRCommentSerializer(many=True, read_only=True)
    sourceBranch = serializers.CharField(source='source_branch')
    targetBranch = serializers.CharField(source='target_branch')

    class Meta:
        model = PullRequest
        fields = [
            'id', 'number', 'title', 'description', 'repository_name',
            'author', 'sourceBranch', 'targetBranch', 'status',
            'is_mergeable', 'merged_at', 'changed_files', 'additions',
            'deletions', 'reviews', 'comments', 'created_at', 'updated_at'
        ]

    def get_author(self, obj):
        profile = getattr(obj.author, 'profile', None)
        return {
            'username': obj.author.username,
            'name': obj.author.full_name,
            'avatar': profile.avatar.url if profile and profile.avatar else 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'
        }
