from rest_framework import serializers
from .models import Issue, IssueComment, Label, Milestone


class LabelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Label
        fields = ['id', 'name', 'color', 'description']


class MilestoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Milestone
        fields = ['id', 'title', 'description', 'due_date', 'status']


class IssueCommentSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()

    class Meta:
        model = IssueComment
        fields = ['id', 'text', 'author', 'created_at']

    def get_author(self, obj):
        profile = getattr(obj.author, 'profile', None)
        return {
            'username': obj.author.username,
            'name': obj.author.full_name,
            'avatar': profile.avatar.url if profile and profile.avatar else 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'
        }


class IssueSerializer(serializers.ModelSerializer):
    repository_name = serializers.CharField(source='repository.name', read_only=True)
    author = serializers.SerializerMethodField()
    labels = LabelSerializer(many=True, read_only=True)
    milestone = MilestoneSerializer(read_only=True)
    comments = IssueCommentSerializer(many=True, read_only=True)

    class Meta:
        model = Issue
        fields = [
            'id', 'number', 'title', 'description', 'repository_name',
            'author', 'status', 'labels', 'milestone', 'comments',
            'closed_at', 'created_at', 'updated_at'
        ]

    def get_author(self, obj):
        profile = getattr(obj.author, 'profile', None)
        return {
            'username': obj.author.username,
            'name': obj.author.full_name,
            'avatar': profile.avatar.url if profile and profile.avatar else 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'
        }
