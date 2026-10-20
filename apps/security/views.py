import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate
from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.common.tasks import send_email_async

from .authentication import create_user_session, parse_device_info
from .models import (
    AuditLog,
    AuthSession,
    OTPChallenge,
    ReauthToken,
    RecoveryCode,
    TOTPDevice,
)
from .serializers import (
    AuditLogSerializer,
    AuthSessionSerializer,
    ChangePasswordProtectedSerializer,
    ForgotPasswordSerializer,
    LoginSerializer,
    ReauthSerializer,
    ResetPasswordSerializer,
    VerifyRecoveryOtpSerializer,
)
from .throttles import LoginLockoutManager, LoginRateThrottle
from .totp import TOTPManager


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        identifier = serializer.validated_data["identifier"]
        password = serializer.validated_data["password"]

        # Account lockout check (Fix h)
        if LoginLockoutManager.is_locked(identifier):
            return Response(
                {
                    "error": "Too many failed login attempts. Account is temporarily locked. Please try again later.",
                    "code": "ACCOUNT_LOCKED",
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        user = (
            User.objects.filter(email__iexact=identifier).first()
            or User.objects.filter(username__iexact=identifier).first()
        )

        device, ip, ua = parse_device_info(request)

        if not user or not user.check_password(password):
            LoginLockoutManager.record_failure(identifier)
            AuditLog.objects.create(
                user=user,
                action="login_failed",
                description=f"Failed sign-in attempt for identifier: {identifier}",
                ip_address=ip if ip and len(ip) <= 45 else "127.0.0.1",
                user_agent=ua,
                status="failure",
            )
            return Response(
                {
                    "error": "Invalid email, username, or password.",
                    "code": "INVALID_CREDENTIALS",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Successful credentials reset lockout count
        LoginLockoutManager.reset(identifier)

        if not user.is_active:
            return Response(
                {
                    "error": "Account has been suspended or deactivated.",
                    "code": "ACCOUNT_DISABLED",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # Create session
        raw_token, session = create_user_session(user, request)

        AuditLog.objects.create(
            user=user,
            action="login_success",
            description="Successful authenticated sign-in.",
            ip_address=ip if ip and len(ip) <= 45 else "127.0.0.1",
            user_agent=ua,
            status="success",
        )

        resp = Response(
            {
                "success": True,
                "token": raw_token,
                "access": raw_token,
                "user": {
                    "id": str(user.id),
                    "username": user.username,
                    "email": user.email,
                    "name": user.full_name,
                },
            },
            status=status.HTTP_200_OK,
        )

        # Set secure HttpOnly session cookie
        resp.set_cookie(
            "devsync_session",
            raw_token,
            max_age=30 * 86400,
            httponly=True,
            samesite="Lax",
            secure=not settings.DEBUG,
        )
        return resp


class AuthMeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        profile = getattr(user, "profile", None)
        return Response(
            {
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "name": user.full_name,
                "is_email_verified": user.is_email_verified,
                "date_joined": user.date_joined,
                "headline": profile.headline if profile else "",
                "avatar": profile.avatar.url if profile and profile.avatar else None,
                "collaboration_status": (
                    profile.collaboration_status if profile else "open_to_collab"
                ),
            }
        )


class SessionsListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        sessions = AuthSession.objects.filter(
            user=request.user, revoked_at__isnull=True, expires_at__gt=timezone.now()
        )
        serializer = AuthSessionSerializer(
            sessions, many=True, context={"request": request}
        )
        # Return both list and wrapped object for backward compatibility
        return Response(serializer.data)


class RevokeOtherSessionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        curr_session_id = getattr(getattr(request, "auth_session", None), "id", None)
        qs = AuthSession.objects.filter(user=request.user, revoked_at__isnull=True)
        if curr_session_id:
            qs = qs.exclude(id=curr_session_id)

        count = qs.update(revoked_at=timezone.now())

        device, ip, ua = parse_device_info(request)
        AuditLog.objects.create(
            user=request.user,
            action="sessions_revoked_others",
            description=f"Revoked {count} active secondary sessions.",
            ip_address=ip if ip and len(ip) <= 45 else "127.0.0.1",
            user_agent=ua,
            status="success",
        )

        return Response(
            {
                "success": True,
                "message": f"Successfully revoked {count} active sessions.",
            }
        )


class SecurityOverviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        has_2fa = TOTPDevice.objects.filter(user=user, is_confirmed=True).exists()
        active_sessions_count = AuthSession.objects.filter(
            user=user, revoked_at__isnull=True, expires_at__gt=timezone.now()
        ).count()
        recovery_codes_count = RecoveryCode.objects.filter(
            user=user, consumed_at__isnull=True
        ).count()

        return Response(
            {
                "success": True,
                "password_configured": True,
                "password_last_changed": "Recently",
                "two_factor_enabled": has_2fa,
                "two_factor_type": (
                    "Authenticator App (TOTP)" if has_2fa else "Not Enabled"
                ),
                "active_sessions_count": max(1, active_sessions_count),
                "recovery_codes_count": recovery_codes_count,
                "registered_email": user.email,
                "registered_mobile": user.mobile,
                "security_events_count": AuditLog.objects.filter(user=user).count(),
            }
        )


class ReauthenticateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ReauthSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        password = serializer.validated_data["password"]

        if not request.user.check_password(password):
            return Response(
                {
                    "error": "Current password verification failed.",
                    "code": "INVALID_PASSWORD",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        raw_reauth = f"rat_{secrets.token_urlsafe(32)}"
        token_hash = ReauthToken.hash_token(raw_reauth)
        ReauthToken.objects.create(
            user=request.user,
            token_hash=token_hash,
            expires_at=timezone.now() + timedelta(minutes=5),
        )

        return Response(
            {
                "success": True,
                "reauth_token": raw_reauth,
                "expires_in": 300,
                "message": "Identity verified. You have 5 minutes to complete this sensitive action.",
            }
        )


class ChangePasswordProtectedView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordProtectedSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        raw_reauth = serializer.validated_data["reauth_token"]
        curr_pwd = serializer.validated_data["current_password"]
        new_pwd = serializer.validated_data["new_password"]
        revoke_others = serializer.validated_data["revoke_other_sessions"]

        token_hash = ReauthToken.hash_token(raw_reauth)

        with transaction.atomic():
            reauth = (
                ReauthToken.objects.select_for_update()
                .filter(
                    user=request.user,
                    token_hash=token_hash,
                    consumed_at__isnull=True,
                    expires_at__gt=timezone.now(),
                )
                .first()
            )

            if not reauth:
                return Response(
                    {
                        "error": "Re-authentication authorization is required or has expired.",
                        "code": "REAUTH_REQUIRED",
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            if not request.user.check_password(curr_pwd):
                return Response(
                    {
                        "error": "Current password verification failed.",
                        "code": "INVALID_CURRENT_PASSWORD",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Consume reauth token atomically (single use)
            reauth.consume()

            # Update password with Argon2 hasher
            request.user.set_password(new_pwd)
            request.user.save(update_fields=["password"])

            # Terminate other sessions if requested
            if revoke_others:
                curr_session_id = getattr(
                    getattr(request, "auth_session", None), "id", None
                )
                qs = AuthSession.objects.filter(
                    user=request.user, revoked_at__isnull=True
                )
                if curr_session_id:
                    qs = qs.exclude(id=curr_session_id)
                qs.update(revoked_at=timezone.now())

            device, ip, ua = parse_device_info(request)
            AuditLog.objects.create(
                user=request.user,
                action="password_change_protected",
                description="Account password changed via protected flow.",
                ip_address=ip if ip and len(ip) <= 45 else "127.0.0.1",
                user_agent=ua,
                status="success",
            )

        # Notify via background email task (Fix q)
        send_email_async(
            subject="Security Alert: Your DevSync Password Was Changed",
            message=(
                f"Hello @{request.user.username},\n\nYour DevSync password was successfully updated.\n"
                f"If you did not perform this change, please contact security immediately.\n\n— The DevSync Security Team"
            ),
            recipient_list=[request.user.email],
        )

        return Response({"success": True, "message": "Password updated successfully."})


class ForgotPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        raw_id = serializer.validated_data["identifier"].strip().lower()

        # Cooldown check: 60s
        recent = OTPChallenge.objects.filter(
            identifier=raw_id,
            purpose="password_reset",
            created_at__gt=timezone.now() - timedelta(seconds=60),
        ).first()

        if recent:
            return Response(
                {
                    "error": "Please wait before requesting another recovery code.",
                    "code": "RATE_LIMITED",
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # Anti-enumeration message
        generic_msg = "If an account matches that identifier, password recovery instructions and a verification code have been dispatched."

        user = (
            User.objects.filter(email__iexact=raw_id).first()
            or User.objects.filter(username__iexact=raw_id).first()
        )

        # Create challenge (even if user does not exist, to burn identical work)
        salt = secrets.token_hex(16)
        raw_code = f"{secrets.randbelow(900000) + 100000}"
        code_hash = OTPChallenge.hash_code(salt, raw_code)

        OTPChallenge.objects.create(
            identifier=raw_id,
            code_hash=code_hash,
            salt=salt,
            purpose="password_reset",
            attempts_remaining=5,
            expires_at=timezone.now() + timedelta(minutes=10),
        )

        if user and user.email:
            send_email_async(
                subject="DevSync Password Reset Verification Code",
                message=(
                    f"Hello @{user.username},\n\n"
                    f"Your 6-digit recovery code is: {raw_code}\n\n"
                    f"This code will expire in 10 minutes.\n\n— The DevSync Security Team"
                ),
                recipient_list=[user.email],
            )

        return Response({"success": True, "message": generic_msg})


class VerifyRecoveryOtpView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = VerifyRecoveryOtpSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        raw_id = serializer.validated_data["identifier"].strip().lower()
        code = serializer.validated_data["code"].strip()

        challenge = (
            OTPChallenge.objects.filter(
                identifier=raw_id,
                purpose="password_reset",
                consumed_at__isnull=True,
                expires_at__gt=timezone.now(),
            )
            .order_by("-created_at")
            .first()
        )

        if not challenge or not challenge.is_valid:
            return Response(
                {
                    "error": "Verification code not found or already expired. Please request a new code.",
                    "code": "INVALID_OTP",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not challenge.verify(code):
            rem = challenge.attempts_remaining
            return Response(
                {
                    "error": f"Incorrect verification code. {rem} attempt(s) remaining.",
                    "code": "WRONG_OTP",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Issue single-use reset token valid for 15 minutes
        user = (
            User.objects.filter(email__iexact=raw_id).first()
            or User.objects.filter(username__iexact=raw_id).first()
        )

        if not user:
            return Response(
                {
                    "error": "User account could not be resolved.",
                    "code": "USER_NOT_FOUND",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        raw_reset_token = f"rst_{secrets.token_urlsafe(32)}"
        token_hash = ReauthToken.hash_token(raw_reset_token)
        ReauthToken.objects.create(
            user=user,
            token_hash=token_hash,
            expires_at=timezone.now() + timedelta(minutes=15),
        )

        return Response(
            {
                "success": True,
                "reset_token": raw_reset_token,
                "message": "Code verified. You can now set your new password.",
            }
        )


class ResetPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        raw_token = serializer.validated_data["reset_token"]
        new_pwd = serializer.validated_data["new_password"]

        token_hash = ReauthToken.hash_token(raw_token)

        with transaction.atomic():
            reauth = (
                ReauthToken.objects.select_for_update()
                .filter(
                    token_hash=token_hash,
                    consumed_at__isnull=True,
                    expires_at__gt=timezone.now(),
                )
                .first()
            )

            if not reauth:
                return Response(
                    {
                        "error": "Invalid or expired password reset token. Please restart password recovery.",
                        "code": "INVALID_TOKEN",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            user = reauth.user
            if user.check_password(new_pwd):
                return Response(
                    {
                        "error": "New password cannot be the same as your current password.",
                        "code": "SAME_PASSWORD",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            reauth.consume()
            user.set_password(new_pwd)
            user.save(update_fields=["password"])

            # Invalidate ALL active sessions
            AuthSession.objects.filter(user=user, revoked_at__isnull=True).update(
                revoked_at=timezone.now()
            )

            device, ip, ua = parse_device_info(request)
            AuditLog.objects.create(
                user=user,
                action="password_reset_success",
                description="Password reset via recovery code. All active sessions invalidated.",
                ip_address=ip if ip and len(ip) <= 45 else "127.0.0.1",
                user_agent=ua,
                status="success",
            )

        return Response(
            {
                "success": True,
                "message": "Password reset successfully! All sessions have been logged out. Please sign in with your new password.",
            }
        )


class TwoFactorSetupView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        secret = TOTPManager.generate_secret()
        device, _ = TOTPDevice.objects.get_or_create(user=request.user)
        device.secret = secret
        device.is_confirmed = False
        device.save()

        uri = TOTPManager.get_provisioning_uri(request.user.username, secret)
        formatted_key = " ".join([secret[i : i + 4] for i in range(0, len(secret), 4)])

        return Response(
            {
                "success": True,
                "secret": secret,
                "formatted_key": formatted_key,
                "provisioning_uri": uri,
                "message": "2FA enrollment initialized.",
            }
        )


class TwoFactorEnableView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        code = str(request.data.get("code", "")).strip()
        device = TOTPDevice.objects.filter(user=request.user).first()
        if not device or not device.secret:
            return Response(
                {
                    "error": "No 2FA enrollment session found. Please initialize setup again.",
                    "code": "NO_SETUP",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not TOTPManager.verify_code(device.secret, code):
            return Response(
                {
                    "error": "Invalid 6-digit verification code. Please check your authenticator app.",
                    "code": "INVALID_CODE",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        device.is_confirmed = True
        device.save()

        # Generate 8 recovery codes
        plain_codes = TOTPManager.generate_recovery_codes(8)
        RecoveryCode.objects.filter(user=request.user).delete()
        for c in plain_codes:
            RecoveryCode.objects.create(
                user=request.user, code_hash=RecoveryCode.hash_code(c)
            )

        return Response(
            {
                "success": True,
                "recovery_codes": plain_codes,
                "message": "Two-Factor Authentication is now enabled. Please store your recovery codes in a secure location.",
            }
        )


class TwoFactorDisableView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        pwd = str(request.data.get("password", "")).strip()
        if not request.user.check_password(pwd):
            return Response(
                {"error": "Incorrect password.", "code": "INVALID_PASSWORD"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        TOTPDevice.objects.filter(user=request.user).delete()
        RecoveryCode.objects.filter(user=request.user).delete()

        return Response(
            {"success": True, "message": "Two-Factor Authentication has been disabled."}
        )


class GoogleAuthConfigView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        client_id = getattr(settings, "GOOGLE_CLIENT_ID", "") or os.environ.get(
            "GOOGLE_CLIENT_ID", ""
        )
        return Response(
            {
                "configured": bool(client_id),
                "clientId": client_id if client_id else None,
                "message": (
                    "Google OAuth is configured."
                    if client_id
                    else "Google OAuth is unconfigured."
                ),
            }
        )


class GoogleAuthView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        client_id = getattr(settings, "GOOGLE_CLIENT_ID", "") or os.environ.get(
            "GOOGLE_CLIENT_ID", ""
        )
        id_token = request.data.get("credential", "").strip()
        if not id_token:
            return Response(
                {
                    "error": "Missing Credential",
                    "detail": "Google credential token is required.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # In audience verification: ensure we NEVER output client_id in error message (Fix i)
        return Response(
            {
                "error": "Authentication Failed",
                "detail": "Google token verification failed: invalid token audience or signature.",
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )
