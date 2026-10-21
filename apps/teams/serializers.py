from rest_framework import serializers
from .models import Team, Membership, Invitation


class TeamSerializer(serializers.ModelSerializer):
    membersCount = serializers.IntegerField(source='members_count', read_only=True)

    class Meta:
        model = Team
        fields = ['id', 'name', 'slug', 'description', 'avatar', 'membersCount']


class MemberSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    name = serializers.CharField(source='user.full_name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    team_name = serializers.CharField(source='team.name', read_only=True)
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = Membership
        fields = ['id', 'username', 'name', 'email', 'role', 'project', 'team_name', 'avatar']

    def get_avatar(self, obj):
        profile = getattr(obj.user, 'profile', None)
        if profile and profile.avatar:
            return profile.avatar.url
        return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'


class InvitationSerializer(serializers.ModelSerializer):
    team_name = serializers.CharField(source='team.name', read_only=True)

    class Meta:
        model = Invitation
        fields = ['id', 'email', 'name', 'role', 'project', 'team_name', 'status', 'expires_at']
