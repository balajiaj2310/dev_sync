from datetime import timedelta

import pytest
from django.db import IntegrityError
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import (
    Achievement,
    Connection,
    Education,
    Experience,
    Profile,
    Skill,
    User,
)
from apps.security.authentication import create_user_session
from apps.security.models import AuthSession, OTPChallenge, ReauthToken, TOTPDevice
from apps.security.totp import TOTPManager


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def demo_user(db):
    user = User.objects.create(
        username="testdeveloper",
        email="testdev@devsync.dev",
        is_email_verified=True,
        is_active=True,
    )
    user.set_password("SecurePass123!")
    user.save()

    Profile.objects.create(
        user=user,
        headline="Crafting resilient distributed systems",
        bio="Full-time Python & Django enthusiast",
        location="Bengaluru, India",
    )
    return user


@pytest.mark.django_db
class TestAccountsModels:
    def test_user_creation_and_argon2_hashing(self, demo_user):
        assert demo_user.username == "testdeveloper"
        assert demo_user.email == "testdev@devsync.dev"
        assert demo_user.check_password("SecurePass123!")
        assert demo_user.password.startswith("argon2")

    def test_unique_lower_username_constraint(self, demo_user):
        with pytest.raises(IntegrityError):
            u = User(username="TESTDEVELOPER", email="diff@devsync.dev")
            u.set_password("AnotherPass123!")
            u.save()

    def test_unique_lower_email_constraint(self, demo_user):
        with pytest.raises(IntegrityError):
            u = User(username="diffuser", email="TESTDEV@devsync.dev")
            u.set_password("AnotherPass123!")
            u.save()

    def test_connection_self_prevent_constraint(self, demo_user):
        with pytest.raises(IntegrityError):
            Connection.objects.create(
                requester=demo_user, recipient=demo_user, status="pending"
            )

    def test_connection_unique_pair_constraint(self, demo_user):
        other = User.objects.create(username="otherdev", email="other@devsync.dev")
        Connection.objects.create(
            requester=demo_user, recipient=other, status="pending"
        )
        with pytest.raises(IntegrityError):
            Connection.objects.create(
                requester=demo_user, recipient=other, status="accepted"
            )


@pytest.mark.django_db
class TestSecurityMechanisms:
    def test_session_token_hashing(self, demo_user):
        raw_token, session = create_user_session(demo_user)
        assert raw_token != session.token_hash
        assert session.is_valid
        assert not session.is_expired

    def test_reauth_token_single_use(self, demo_user):
        raw_tok, token_obj = ReauthToken.generate_for_user(demo_user)
        assert token_obj.is_valid

        # Test verification and consumption
        verified = ReauthToken.verify_and_consume(demo_user, raw_tok)
        assert verified is True

        # Replay attack should fail
        replay = ReauthToken.verify_and_consume(demo_user, raw_tok)
        assert replay is False

    def test_otp_challenge_flow(self, demo_user):
        challenge, raw_code = OTPChallenge.create_challenge(
            demo_user.email, purpose="recovery"
        )
        assert len(raw_code) == 6
        assert challenge.attempts_left == 3

        # Bad verification attempts
        assert challenge.verify("000000") is False
        challenge.refresh_from_db()
        assert challenge.attempts_left == 2

        # Correct verification
        assert challenge.verify(raw_code) is True
        challenge.refresh_from_db()
        assert challenge.consumed_at is not None

        # Replay should fail
        assert challenge.verify(raw_code) is False

    def test_totp_manager_flow(self):
        secret = TOTPManager.generate_secret()
        uri = TOTPManager.get_provisioning_uri("user1", secret)
        assert "otpauth://totp/DevSync:user1" in uri

        code = TOTPManager.compute_totp(secret)
        assert TOTPManager.verify_code(secret, code) is True
        assert TOTPManager.verify_code(secret, "999999") is False


@pytest.mark.django_db
class TestAuthAndSecurityAPIs:
    def test_login_success_and_cookie(self, api_client, demo_user):
        res = api_client.post(
            "/api/v1/auth/login",
            {"identifier": "testdeveloper", "password": "SecurePass123!"},
            format="json",
        )
        assert res.status_code == 200
        assert "token" in res.data
        assert "devsync_session" in res.cookies

    def test_login_invalid_credentials(self, api_client, demo_user):
        res = api_client.post(
            "/api/v1/auth/login",
            {"identifier": "testdeveloper", "password": "WrongPassword123"},
            format="json",
        )
        assert res.status_code == 400
        assert res.data["code"] == "INVALID_CREDENTIALS"

    def test_auth_me_with_bearer_token(self, api_client, demo_user):
        raw_token, _ = create_user_session(demo_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {raw_token}")
        res = api_client.get("/api/v1/auth/me")
        assert res.status_code == 200
        assert res.data["username"] == "testdeveloper"

    def test_security_overview(self, api_client, demo_user):
        raw_token, _ = create_user_session(demo_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {raw_token}")
        res = api_client.get("/api/v1/auth/security/overview")
        assert res.status_code == 200
        assert res.data["password_configured"] is True
        assert res.data["two_factor_enabled"] is False
        assert res.data["active_sessions_count"] >= 1

    def test_reauthenticate_and_change_password(self, api_client, demo_user):
        raw_token, _ = create_user_session(demo_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {raw_token}")

        # Reauthenticate with wrong password
        bad_reauth = api_client.post(
            "/api/v1/auth/security/reauthenticate",
            {"password": "WrongPassword!"},
            format="json",
        )
        assert bad_reauth.status_code == 400

        # Valid reauthenticate
        good_reauth = api_client.post(
            "/api/v1/auth/security/reauthenticate",
            {"password": "SecurePass123!"},
            format="json",
        )
        assert good_reauth.status_code == 200
        reauth_token = good_reauth.data["reauth_token"]

        # Attempt change password with same password
        same_res = api_client.post(
            "/api/v1/auth/password/change-protected",
            {
                "reauth_token": reauth_token,
                "current_password": "SecurePass123!",
                "new_password": "SecurePass123!",
            },
            format="json",
        )
        assert same_res.status_code == 400

        # Change with new reauth token
        good_reauth2 = api_client.post(
            "/api/v1/auth/security/reauthenticate",
            {"password": "SecurePass123!"},
            format="json",
        )
        reauth_token2 = good_reauth2.data["reauth_token"]

        change_res = api_client.post(
            "/api/v1/auth/password/change-protected",
            {
                "reauth_token": reauth_token2,
                "current_password": "SecurePass123!",
                "new_password": "SuperNewPassword456!",
            },
            format="json",
        )
        assert change_res.status_code == 200

        # Verify old password is now invalid
        demo_user.refresh_from_db()
        assert demo_user.check_password("SuperNewPassword456!")
        assert not demo_user.check_password("SecurePass123!")

    def test_forgot_password_and_otp_reset_flow(self, api_client, demo_user):
        # 1. Request OTP
        req_res = api_client.post(
            "/api/v1/auth/password/forgot",
            {"identifier": "testdev@devsync.dev"},
            format="json",
        )
        assert req_res.status_code == 200
        assert req_res.data["success"] is True

        # Anti-enumeration returns 200 for nonexistent user
        req_fake = api_client.post(
            "/api/v1/auth/password/forgot",
            {"identifier": "nonexistent@devsync.dev"},
            format="json",
        )
        assert req_fake.status_code == 200

        # Simulate knowing the secret raw code by generating a challenge directly
        test_challenge, raw_code = OTPChallenge.create_challenge(
            "testdev@devsync.dev", purpose="password_reset"
        )

        # 3. Verify OTP
        v_res = api_client.post(
            "/api/v1/auth/password/verify-recovery-otp",
            {"identifier": "testdev@devsync.dev", "code": raw_code},
            format="json",
        )
        assert v_res.status_code == 200
        reset_token = v_res.data["reset_token"]

        # 4. Reset password
        reset_res = api_client.post(
            "/api/v1/auth/password/reset",
            {"reset_token": reset_token, "new_password": "NewlyResetPassword789!"},
            format="json",
        )
        assert reset_res.status_code == 200

        # Verify new password
        demo_user.refresh_from_db()
        assert demo_user.check_password("NewlyResetPassword789!")


@pytest.mark.django_db
class TestAccountsPublicAPIs:
    def test_public_profile(self, api_client, demo_user):
        res = api_client.get(f"/api/v1/u/{demo_user.username}")
        assert res.status_code == 200
        assert res.data["username"] == demo_user.username
        assert res.data["headline"] == "Crafting resilient distributed systems"
        # Verify strict privacy whitelisting: email should NOT be exposed in public profile
        assert "email" not in res.data
        assert "password" not in res.data

    def test_developers_list(self, api_client, demo_user):
        res = api_client.get("/api/v1/developers")
        assert res.status_code == 200
        assert "results" in res.data
        assert len(res.data["results"]) >= 1
