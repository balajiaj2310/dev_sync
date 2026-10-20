from rest_framework import serializers

from .models import AuditLog, AuthSession


class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField(required=False)
    login = serializers.CharField(required=False)
    email = serializers.CharField(required=False)
    username = serializers.CharField(required=False)
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        identifier = (
            attrs.get("identifier")
            or attrs.get("login")
            or attrs.get("email")
            or attrs.get("username")
        )
        if not identifier:
            raise serializers.ValidationError(
                {"identifier": "Username or email is required."}
            )
        attrs["identifier"] = identifier.strip().lower()
        return attrs


class AuthSessionSerializer(serializers.ModelSerializer):
    is_current = serializers.SerializerMethodField()
    last_active_formatted = serializers.DateTimeField(
        source="last_active", format="%b %d, %Y, %I:%M %p"
    )

    class Meta:
        model = AuthSession
        fields = [
            "id",
            "device",
            "ip_address",
            "last_active",
            "last_active_formatted",
            "is_current",
        ]

    def get_is_current(self, obj):
        request = self.context.get("request")
        if request and hasattr(request, "auth_session"):
            return request.auth_session.id == obj.id
        return False


class AuditLogSerializer(serializers.ModelSerializer):
    timestamp = serializers.DateTimeField(
        source="created_at", format="%b %d, %Y, %I:%M %p"
    )

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "action",
            "description",
            "ip_address",
            "user_agent",
            "status",
            "timestamp",
        ]


class ReauthSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, required=True)


class ChangePasswordProtectedSerializer(serializers.Serializer):
    reauth_token = serializers.CharField(required=True)
    current_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, min_length=8, write_only=True)
    confirm_password = serializers.CharField(required=False, write_only=True)
    revoke_other_sessions = serializers.BooleanField(required=False, default=True)

    def validate(self, attrs):
        new_pwd = attrs.get("new_password")
        curr_pwd = attrs.get("current_password")
        conf_pwd = attrs.get("confirm_password")

        if conf_pwd and new_pwd != conf_pwd:
            raise serializers.ValidationError(
                {"confirm_password": "New passwords do not match."}
            )
        if new_pwd == curr_pwd:
            raise serializers.ValidationError(
                {
                    "new_password": "New password cannot be the same as your current password."
                }
            )
        return attrs


class ForgotPasswordSerializer(serializers.Serializer):
    identifier = serializers.CharField(required=True)


class VerifyRecoveryOtpSerializer(serializers.Serializer):
    identifier = serializers.CharField(required=True)
    code = serializers.CharField(required=True, min_length=6, max_length=6)


class ResetPasswordSerializer(serializers.Serializer):
    reset_token = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=8, write_only=True)
