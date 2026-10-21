from rest_framework import serializers
from .models import User, Profile, Skill, Education, Experience, Achievement, Connection

class SkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = ['id', 'name', 'level']


class EducationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Education
        fields = ['id', 'institution', 'degree', 'field_of_study', 'start_year', 'end_year']


class ExperienceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Experience
        fields = ['id', 'company', 'title', 'location', 'start_date', 'end_date', 'is_current', 'description']


class AchievementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Achievement
        fields = ['id', 'title', 'description', 'badge_icon', 'date_earned']


class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    name = serializers.CharField(source='user.full_name', read_only=True)

    class Meta:
        model = Profile
        fields = [
            'id', 'username', 'email', 'name', 'headline', 'bio',
            'location', 'website', 'github_url', 'twitter_url', 'linkedin_url',
            'collaboration_status', 'experience_level', 'avatar', 'preferences'
        ]


class PublicProfileSerializer(serializers.ModelSerializer):
    """
    CRITICAL SECURITY RULE: Public Profile Serializer strictly whitelists public fields.
    Never exposes registered email, mobile phone, password hashes, or session audit logs.
    """
    username = serializers.CharField(source='user.username', read_only=True)
    name = serializers.CharField(source='user.full_name', read_only=True)
    avatar = serializers.ImageField(read_only=True)
    skills = SkillSerializer(source='user.skills', many=True, read_only=True)
    achievements = AchievementSerializer(source='user.achievements', many=True, read_only=True)
    joined_date = serializers.DateTimeField(source='user.date_joined', format="%B %Y", read_only=True)

    class Meta:
        model = Profile
        fields = [
            'username', 'name', 'headline', 'bio', 'location',
            'website', 'github_url', 'twitter_url', 'linkedin_url',
            'collaboration_status', 'experience_level', 'avatar',
            'joined_date', 'skills', 'achievements'
        ]


class ConnectionSerializer(serializers.ModelSerializer):
    requester_username = serializers.CharField(source='requester.username', read_only=True)
    recipient_username = serializers.CharField(source='recipient.username', read_only=True)

    class Meta:
        model = Connection
        fields = ['id', 'requester_username', 'recipient_username', 'status', 'created_at']
        read_only_fields = ['id', 'status', 'created_at']
