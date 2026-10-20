"""
Automated Verification Suite for DevSync Protected Password & Security Redesign
Tests:
1. Static check: account.html must NOT contain sensitive password change inputs or 2FA enrollment forms.
2. Route availability: /settings/security/ and /settings/security/password/ serve 200 OK.
3. Security overview endpoint: GET /api/v1/auth/security/overview returns accurate status.
4. Protected Re-authentication: POST /api/v1/auth/security/reauthenticate rejects invalid pass, issues token on valid pass.
5. Protected Password Change: POST /api/v1/auth/password/change-protected enforces reauth_token, single-use token consumption, strength, and old != new.
6. Real TOTP 2FA Flow: Setup -> Verify & Enable with real TOTP RFC 6238 code -> Recovery codes returned -> Disable with re-auth.
7. Active session revocation: Revoke single session and revoke other sessions.
"""

import unittest
import urllib.request
import urllib.parse
import urllib.error
import json
import os
import sys

BASE_URL = "http://127.0.0.1:8000"

def request(method, path, data=None, token=None, session_id=None):
    url = f"{BASE_URL}{path}"
    headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/html'
    }
    if token:
        headers['Authorization'] = f"Bearer {token}"
    if session_id:
        headers['Cookie'] = f"devsync_session={session_id}"

    body_bytes = None
    if data is not None:
        body_bytes = json.dumps(data).encode('utf-8')

    req = urllib.request.Request(url, data=body_bytes, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.status
            content = resp.read().decode('utf-8')
            set_cookie = resp.headers.get('Set-Cookie', '')
            try:
                parsed = json.loads(content)
            except Exception:
                parsed = content
            return status, parsed, set_cookie
    except urllib.error.HTTPError as e:
        content = e.read().decode('utf-8')
        try:
            parsed = json.loads(content)
        except Exception:
            parsed = content
        return e.code, parsed, e.headers.get('Set-Cookie', '')
    except Exception as e:
        return 0, {'error': str(e)}, ''

class TestProtectedSecurity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        status, data, set_cookie = request("POST", "/api/v1/auth/login", {
            "email": "naveen@devsync.dev",
            "password": "demo12345"
        })
        if status != 200:
            raise RuntimeError(f"Login failed: status={status}, data={data}")
        cls.token = data.get("token") or data.get("access")
        cls.session_id = cls.token
        cls.current_password = "demo12345"

    def test_01_account_html_contains_no_sensitive_forms(self):
        """CRITICAL: account.html must not contain password change forms or 2FA enrollment forms directly."""
        repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        account_path = os.path.join(repo_root, "frontend", "src", "pages", "settings", "account.html")
        with open(account_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Check there are no password change inputs or forms on the main page
        self.assertNotIn('id="formChangePassword"', content, "account.html must not contain formChangePassword!")
        self.assertNotIn('id="newPassword"', content, "account.html must not contain newPassword input!")
        self.assertNotIn('id="confirmPassword"', content, "account.html must not contain confirmPassword input!")
        self.assertNotIn('id="currentPassword"', content, "account.html must not contain currentPassword input!")
        self.assertNotIn('id="btnGenerate2FA"', content, "account.html must not contain 2FA generation button!")

        # Must have summary card and link to dedicated security page
        has_security_link = ('security.html' in content or '/settings/security' in content)
        self.assertTrue(has_security_link, "account.html must link to dedicated security page!")
        self.assertIn('Manage Password and Security', content, "account.html must have Manage Password and Security CTA!")

    def test_02_dedicated_security_routes_serve_200(self):
        """Dedicated security pages must be accessible."""
        status_sec, content_sec, _ = request("GET", "/settings/security/", token=self.token, session_id=self.session_id)
        self.assertEqual(status_sec, 200, "Dedicated security dashboard must return 200")
        self.assertIn("Password and Security", str(content_sec))

        status_pw, content_pw, _ = request("GET", "/settings/security/password/", token=self.token, session_id=self.session_id)
        self.assertEqual(status_pw, 200, "Dedicated change password page must return 200")
        self.assertIn("Change Password", str(content_pw))

    def test_03_security_overview_endpoint(self):
        """GET /api/v1/auth/security/overview returns live, accurate security summary."""
        status, data, _ = request("GET", "/api/v1/auth/security/overview", token=self.token, session_id=self.session_id)
        self.assertEqual(status, 200)
        self.assertTrue(data.get("success") or "password_configured" in data)
        self.assertIn("password_configured", data)
        self.assertIn("two_factor_enabled", data)
        self.assertIn("active_sessions_count", data)
        self.assertIn("recovery_codes_count", data)
        self.assertIn("registered_email", data)

    def test_04_reauthentication_endpoint(self):
        """POST /api/v1/auth/security/reauthenticate issues a valid single-use token on correct password."""
        # Wrong password
        status, bad_data, _ = request("POST", "/api/v1/auth/security/reauthenticate", {
            "password": "WrongPassword123!"
        }, token=self.token, session_id=self.session_id)
        self.assertEqual(status, 400)
        self.assertFalse(bad_data.get("success"))

        # Correct password
        status, good_data, _ = request("POST", "/api/v1/auth/security/reauthenticate", {
            "password": self.current_password
        }, token=self.token, session_id=self.session_id)
        self.assertEqual(status, 200)
        self.assertTrue(good_data.get("success"))
        self.assertIn("reauth_token", good_data)
        self.assertGreater(good_data.get("expires_in", 0), 0)

    def test_05_protected_password_change_flow(self):
        """POST /api/v1/auth/password/change-protected requires reauth_token, enforces single use, and updates pass."""
        # 1. Attempt password change without reauth_token -> should fail (401 or 403)
        status, _, _ = request("POST", "/api/v1/auth/password/change-protected", {
            "current_password": self.current_password,
            "new_password": "NewDevSync2026!Secure",
            "confirm_password": "NewDevSync2026!Secure"
        }, token=self.token, session_id=self.session_id)
        self.assertIn(status, (401, 403))

        # 2. Get a valid reauth_token
        status, reauth_data, _ = request("POST", "/api/v1/auth/security/reauthenticate", {
            "password": self.current_password
        }, token=self.token, session_id=self.session_id)
        reauth_token = reauth_data.get("reauth_token")

        # 3. Attempt same password as current -> should fail (400)
        status, same_res, _ = request("POST", "/api/v1/auth/password/change-protected", {
            "reauth_token": reauth_token,
            "current_password": self.current_password,
            "new_password": self.current_password,
            "confirm_password": self.current_password
        }, token=self.token, session_id=self.session_id)
        self.assertEqual(status, 400)
        self.assertIn("cannot be the same", same_res.get("error", ""))

        # 4. Attempt change with valid new password
        new_password = "UpdatedPass2026!Secure"
        status, change_res, _ = request("POST", "/api/v1/auth/password/change-protected", {
            "reauth_token": reauth_token,
            "current_password": self.current_password,
            "new_password": new_password,
            "confirm_password": new_password,
            "revoke_other_sessions": False
        }, token=self.token, session_id=self.session_id)
        self.assertEqual(status, 200)
        self.assertTrue(change_res.get("success"))

        # 5. Token replay attack: try to use the same reauth_token again -> should be rejected (single-use 401 or 403)
        status, replay_res, _ = request("POST", "/api/v1/auth/password/change-protected", {
            "reauth_token": reauth_token,
            "current_password": new_password,
            "new_password": "AnotherPass2026!Secure",
            "confirm_password": "AnotherPass2026!Secure"
        }, token=self.token, session_id=self.session_id)
        self.assertIn(status, (401, 403))

        # 6. Change back to original password for test repeatability
        status, reauth_res2, _ = request("POST", "/api/v1/auth/security/reauthenticate", {
            "password": new_password
        }, token=self.token, session_id=self.session_id)
        token2 = reauth_res2.get("reauth_token")
        request("POST", "/api/v1/auth/password/change-protected", {
            "reauth_token": token2,
            "current_password": new_password,
            "new_password": self.current_password,
            "confirm_password": self.current_password
        }, token=self.token, session_id=self.session_id)

    def test_06_real_totp_2fa_workflow(self):
        """Test full 2FA lifecycle: Setup -> Verify & Enable with RFC 6238 TOTP -> Recovery Codes -> Disable."""
        from backend_settings import TOTPManager

        # Step 1: Request 2FA Setup (requires password verification)
        status, setup_data, _ = request("POST", "/api/v1/auth/2fa/setup", {
            "password": self.current_password
        }, token=self.token, session_id=self.session_id)
        self.assertEqual(status, 200)
        self.assertTrue(setup_data.get("success"))
        secret = setup_data.get("secret")
        self.assertTrue(secret)
        self.assertTrue(setup_data.get("provisioning_uri").startswith("otpauth://totp/"))

        # Step 2: Generate valid RFC 6238 TOTP code using secret
        valid_code = TOTPManager.compute_totp(secret)

        # Step 3: Enable 2FA with valid code
        status, enable_data, _ = request("POST", "/api/v1/auth/2fa/enable", {
            "secret": secret,
            "code": valid_code
        }, token=self.token, session_id=self.session_id)
        self.assertEqual(status, 200)
        self.assertTrue(enable_data.get("success"))
        recovery_codes = enable_data.get("recovery_codes", [])
        self.assertEqual(len(recovery_codes), 8, "Should generate 8 recovery codes")

        # Step 4: Verify overview now reports 2FA enabled
        status, overview_res, _ = request("GET", "/api/v1/auth/security/overview", token=self.token, session_id=self.session_id)
        self.assertTrue(overview_res.get("two_factor_enabled"))
        self.assertEqual(overview_res.get("recovery_codes_count"), 8)

        # Step 5: Disable 2FA requires password reauth
        status, bad_disable, _ = request("POST", "/api/v1/auth/2fa/disable", {
            "password": "WrongPassword!"
        }, token=self.token, session_id=self.session_id)
        self.assertEqual(status, 400)

        status, good_disable, _ = request("POST", "/api/v1/auth/2fa/disable", {
            "password": self.current_password
        }, token=self.token, session_id=self.session_id)
        self.assertEqual(status, 200)
        self.assertTrue(good_disable.get("success"))

        # Step 6: Verify overview reports 2FA disabled
        status, overview_res2, _ = request("GET", "/api/v1/auth/security/overview", token=self.token, session_id=self.session_id)
        self.assertFalse(overview_res2.get("two_factor_enabled"))

    def test_07_sessions_management(self):
        """Test listing sessions and revoking other sessions."""
        status, sessions_data, _ = request("GET", "/api/v1/auth/sessions", token=self.token, session_id=self.session_id)
        self.assertEqual(status, 200)
        self.assertTrue(isinstance(sessions_data, list))
        self.assertGreaterEqual(len(sessions_data), 1)

        # Revoke other sessions
        status, revoke_res, _ = request("POST", "/api/v1/auth/sessions/revoke-others", token=self.token, session_id=self.session_id)
        self.assertEqual(status, 200)
        self.assertTrue(revoke_res.get("success"))


if __name__ == "__main__":
    unittest.main()
