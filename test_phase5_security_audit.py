"""
DevSync Phase 5 Security Verification Suite
Tests:
- Path traversal protection on static file server & repository file uploads
- Sensitive file exposure prevention (.env, devsync_database.json, private server scripts)
- IDOR and Role-Based Access Control (RBAC) boundaries
- Public profile data privacy boundary (no passwords, emails, phones, or audit logs exposed)
- API key secrecy (GEMINI_API_KEY never exposed in responses)
- Rate limiting enforcement on sensitive authentication & OTP endpoints
- Password change re-auth protection & single-use token consumption
- Privilege escalation prevention
"""

import unittest
import urllib.request
import urllib.parse
import urllib.error
import json
import time

BASE_URL = "http://127.0.0.1:8000"


def send_req(method, path, data=None, token=None, custom_headers=None):
    url = f"{BASE_URL}{path}"
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if custom_headers:
        headers.update(custom_headers)
    
    body_bytes = None
    if data is not None:
        if isinstance(data, (bytes, bytearray)):
            body_bytes = data
        elif isinstance(data, str):
            body_bytes = data.encode("utf-8")
        else:
            body_bytes = json.dumps(data).encode("utf-8")
        if "Content-Type" not in headers:
            headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=body_bytes, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            content = resp.read().decode("utf-8", errors="replace")
            try:
                parsed = json.loads(content)
            except Exception:
                parsed = content
            return resp.status, parsed
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(content)
        except Exception:
            parsed = content
        return e.code, parsed
    except Exception as e:
        return 0, {"error": str(e)}


class TestPhase5SecurityAudit(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Authenticate naveen3438 (Owner/Maintainer)
        st, res = send_req("POST", "/api/v1/auth/login", {
            "email": "naveen@devsync.dev",
            "password": "demo12345"
        })
        assert st == 200, f"Login naveen failed: {st} {res}"
        cls.naveen_token = res.get("token") or res.get("access")

        # Authenticate balajikumar (Core Contributor)
        st, res = send_req("POST", "/api/v1/auth/login", {
            "email": "balaji@devsync.dev",
            "password": "demo12345"
        })
        assert st == 200, f"Login balaji failed: {st} {res}"
        cls.balaji_token = res.get("token") or res.get("access")

    # -------------------------------------------------------------
    # 1. Path Traversal & Sensitive File Exposure Prevention
    # -------------------------------------------------------------
    def test_01_prevent_env_file_exposure(self):
        """GET /.env or GET /src/.env must never return 200 with sensitive secrets."""
        for path in ["/.env", "/.env.local", "/src/.env", "/src/../.env", "/%2e%2e/.env"]:
            st, res = send_req("GET", path)
            self.assertIn(st, (400, 403, 404), f"Sensitive path {path} returned HTTP {st}!")
            if isinstance(res, str):
                self.assertNotIn("GEMINI_API_KEY", res)
                self.assertNotIn("GOOGLE_CLIENT_SECRET", res)

    def test_02_prevent_path_traversal_on_file_upload(self):
        """File upload with path traversal ('../') must be rejected with HTTP 400."""
        st, res = send_req("POST", "/api/v1/repositories/devsync-core/upload", {
            "filePath": "../../server.py",
            "content": "# malicious overwrite",
            "branch": "develop"
        }, token=self.naveen_token, custom_headers={"X-DevSync-User": "naveen3438"})
        self.assertEqual(st, 400, f"Expected 400 on path traversal upload, got {st}: {res}")

    def test_03_prevent_static_directory_traversal(self):
        """Attempting to escape frontend directory via HTTP GET must fail."""
        st, res = send_req("GET", "/src/../../server.py")
        self.assertIn(st, (400, 403, 404))

    # -------------------------------------------------------------
    # 2. Privacy & Information Exposure
    # -------------------------------------------------------------
    def test_04_public_profile_never_exposes_sensitive_data(self):
        """GET /api/v1/u/<username> must not expose passwords, phone, or audit logs to public."""
        st, profile = send_req("GET", "/api/v1/u/naveen3438")
        self.assertEqual(st, 200)
        self.assertIsInstance(profile, dict)
        self.assertNotIn("password", profile)
        self.assertNotIn("mobile", profile)
        self.assertNotIn("phone", profile)
        self.assertNotIn("security_audit_log", profile)

    def test_05_auth_me_never_exposes_password_hash(self):
        """GET /api/v1/auth/me returns current user without password hash."""
        st, user = send_req("GET", "/api/v1/auth/me", token=self.naveen_token)
        self.assertEqual(st, 200)
        self.assertNotIn("password", user)

    def test_06_voice_token_endpoint_never_exposes_raw_api_key(self):
        """POST /api/v1/ai/voice/token issues ephemeral credentials without leaking GEMINI_API_KEY."""
        st, res = send_req("POST", "/api/v1/ai/voice/token")
        self.assertEqual(st, 200)
        self.assertTrue(res.get("ok"))
        res_str = json.dumps(res)
        self.assertNotIn("AIzaSy", res_str, "Raw Google API key signature detected in response!")

    # -------------------------------------------------------------
    # 3. Privilege Escalation & Role-Based Access Control
    # -------------------------------------------------------------
    def test_07_viewer_role_cannot_upload_to_repo(self):
        """Non-maintainer without write access is blocked with HTTP 403 from uploading."""
        st, res = send_req("POST", "/api/v1/repositories/devsync-core/upload", {
            "filePath": "test.txt",
            "content": "test",
            "branch": "develop"
        }, custom_headers={"X-DevSync-User": "tarapatel"})
        self.assertEqual(st, 403, f"Expected 403 for unauthorized upload, got {st}: {res}")

    def test_08_non_member_cannot_access_private_repo(self):
        """Non-member cannot read private repository metadata."""
        st, res = send_req("GET", "/api/v1/repositories/heavy-machinery", custom_headers={"X-DevSync-User": "ananyaroy"})
        self.assertEqual(st, 403, f"Expected 403 on private repo, got {st}: {res}")

    def test_09_cannot_remove_repository_owner(self):
        """Attempting to remove repository owner must return HTTP 400."""
        st, res = send_req("DELETE", "/api/v1/repositories/devsync-core/members/balajikumar",
                           token=self.balaji_token, custom_headers={"X-DevSync-User": "balajikumar"})
        self.assertEqual(st, 400, f"Expected 400 when attempting to remove owner, got {st}: {res}")

    # -------------------------------------------------------------
    # 4. Protected Security & Password Change Enforcement
    # -------------------------------------------------------------
    def test_10_password_change_requires_reauth_token(self):
        """POST /api/v1/auth/password/change-protected rejects requests without reauth_token."""
        st, res = send_req("POST", "/api/v1/auth/password/change-protected", {
            "current_password": "demo12345",
            "new_password": "NewDevSync2026!Secure",
            "confirm_password": "NewDevSync2026!Secure"
        }, token=self.naveen_token)
        self.assertIn(st, (401, 403), f"Expected 401/403 without reauth token, got {st}: {res}")

    def test_11_reauth_token_single_use_enforcement(self):
        """Re-auth token cannot be reused for a second password change."""
        # 1. Get reauth token
        st, reauth_res = send_req("POST", "/api/v1/auth/security/reauthenticate", {
            "password": "demo12345"
        }, token=self.naveen_token)
        self.assertEqual(st, 200)
        reauth_token = reauth_res.get("reauth_token")

        # 2. Change password
        temp_pass = "TempPass2026!Valid"
        st, ch_res = send_req("POST", "/api/v1/auth/password/change-protected", {
            "reauth_token": reauth_token,
            "current_password": "demo12345",
            "new_password": temp_pass,
            "confirm_password": temp_pass
        }, token=self.naveen_token)
        self.assertEqual(st, 200, f"Password change failed: {st} {ch_res}")

        # 3. Attempt replay with same reauth_token
        st_replay, rep_res = send_req("POST", "/api/v1/auth/password/change-protected", {
            "reauth_token": reauth_token,
            "current_password": temp_pass,
            "new_password": "AnotherPass2026!Valid",
            "confirm_password": "AnotherPass2026!Valid"
        }, token=self.naveen_token)
        self.assertIn(st_replay, (401, 403), f"Token replay must be rejected, got {st_replay}: {rep_res}")

        # Restore original password
        st_rev, rev_auth = send_req("POST", "/api/v1/auth/security/reauthenticate", {
            "password": temp_pass
        }, token=self.naveen_token)
        self.assertEqual(st_rev, 200)
        rev_tok = rev_auth.get("reauth_token")
        st_rest, _ = send_req("POST", "/api/v1/auth/password/change-protected", {
            "reauth_token": rev_tok,
            "current_password": temp_pass,
            "new_password": "demo12345",
            "confirm_password": "demo12345"
        }, token=self.naveen_token)
        self.assertEqual(st_rest, 200, "Password restoration failed!")

    # -------------------------------------------------------------
    # 5. Rate Limiting Cooldowns
    # -------------------------------------------------------------
    def test_12_password_forgot_rate_limiting_enforced(self):
        """Rapid repeat calls to forgot password return HTTP 429."""
        email = f"cooldown_audit_{int(time.time())}@example.com"
        st1, _ = send_req("POST", "/api/v1/auth/password/forgot", {"identifier": email})
        self.assertEqual(st1, 200)
        st2, res2 = send_req("POST", "/api/v1/auth/password/forgot", {"identifier": email})
        self.assertEqual(st2, 429, f"Expected 429 on repeat forgot call, got {st2}: {res2}")


if __name__ == "__main__":
    unittest.main()
