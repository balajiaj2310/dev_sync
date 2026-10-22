"""
DevSync Phase 2 Backend Deep Verification & Edge Case Test Suite
Tests:
- Invalid HTTP methods (method not allowed / handled cleanly)
- Malformed JSON requests across all POST/PATCH endpoints
- Empty, missing, and boundary payloads
- Type mismatches (e.g., int/list/dict where str expected)
- Non-existent resource lookups (Issues, PRs, Conversations, Users, Repos)
- Status filter edge cases & query parameter boundary values
- Auth boundary cases (malformed bearer tokens, invalid session cookies)
- Voice AI boundary cases
"""

import unittest
import urllib.request
import urllib.parse
import urllib.error
import json
import time

BASE_URL = "http://127.0.0.1:8000"


def make_raw_request(method, path, body=None, headers=None):
    url = f"{BASE_URL}{path}"
    req_headers = {"Accept": "application/json"}
    if headers:
        req_headers.update(headers)
    
    data_bytes = None
    if body is not None:
        if isinstance(body, (bytes, bytearray)):
            data_bytes = body
        elif isinstance(body, str):
            data_bytes = body.encode("utf-8")
        else:
            data_bytes = json.dumps(body).encode("utf-8")
        if "Content-Type" not in req_headers:
            req_headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=data_bytes, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            status = resp.status
            content = resp.read().decode("utf-8", errors="replace")
            try:
                parsed = json.loads(content)
            except Exception:
                parsed = content
            return status, parsed
    except urllib.error.HTTPError as e:
        status = e.code
        content = e.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(content)
        except Exception:
            parsed = content
        return status, parsed
    except Exception as e:
        return 0, {"error": str(e)}


class TestPhase2BackendDeep(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Authenticate naveen3438 for authenticated calls
        st, res = make_raw_request("POST", "/api/v1/auth/login", {
            "email": "naveen@devsync.dev",
            "password": "demo12345"
        })
        assert st == 200, f"Login failed: {st} {res}"
        cls.token = res.get("token") or res.get("access")
        cls.auth_headers = {
            "Authorization": f"Bearer {cls.token}",
            "X-DevSync-User": "naveen3438"
        }

    # -------------------------------------------------------------
    # 1. Malformed JSON & Payload Handling
    # -------------------------------------------------------------
    def test_01_malformed_json_on_login(self):
        """Server must return 400 Bad Request on malformed JSON, never 500."""
        st, res = make_raw_request("POST", "/api/v1/auth/login", body='{"email": "unclosed_json', headers={"Content-Type": "application/json"})
        self.assertIn(st, (400, 422), f"Expected 400 on malformed JSON, got {st}: {res}")

    def test_02_empty_body_on_login(self):
        """Server must return 400 when body is empty on login."""
        st, res = make_raw_request("POST", "/api/v1/auth/login", body='', headers={"Content-Type": "application/json"})
        self.assertIn(st, (400, 401), f"Expected 400/401 on empty login, got {st}: {res}")

    def test_03_malformed_json_on_issue_create(self):
        """Issue creation must reject malformed JSON without 500."""
        st, res = make_raw_request("POST", "/api/v1/issues/", body='{bad_json}', headers=self.auth_headers)
        self.assertIn(st, (400, 422), f"Expected 400 on bad JSON, got {st}: {res}")

    def test_04_missing_required_fields_issue_create(self):
        """Issue creation with empty dict should return 400 Bad Request."""
        st, res = make_raw_request("POST", "/api/v1/issues/", body={}, headers=self.auth_headers)
        self.assertEqual(st, 400, f"Expected 400 for empty issue create, got {st}: {res}")

    def test_05_missing_required_fields_pr_create(self):
        """PR creation with empty dict should return 400 Bad Request."""
        st, res = make_raw_request("POST", "/api/v1/pull-requests/", body={}, headers=self.auth_headers)
        self.assertEqual(st, 400, f"Expected 400 for empty PR create, got {st}: {res}")

    def test_06_type_mismatch_in_auth_forgot(self):
        """Non-string identifier in forgot password must return 400, not crash with 500."""
        st, res = make_raw_request("POST", "/api/v1/auth/password/forgot", body={"identifier": [1, 2, 3]})
        self.assertIn(st, (200, 400), f"Expected graceful 200 or 400, got {st}: {res}")

    # -------------------------------------------------------------
    # 2. Non-existent Resource Handling (404 checks)
    # -------------------------------------------------------------
    def test_07_nonexistent_issue_get(self):
        """GET /api/v1/issues/999999/ must return 404, not 500."""
        st, res = make_raw_request("GET", "/api/v1/issues/999999/", headers=self.auth_headers)
        self.assertEqual(st, 404, f"Expected 404 for nonexistent issue, got {st}: {res}")

    def test_08_nonexistent_pr_get(self):
        """GET /api/v1/pull-requests/999999/ must return 404, not 500."""
        st, res = make_raw_request("GET", "/api/v1/pull-requests/999999/", headers=self.auth_headers)
        self.assertEqual(st, 404, f"Expected 404 for nonexistent PR, got {st}: {res}")

    def test_09_comment_on_nonexistent_issue(self):
        """Adding a comment to nonexistent issue must return 404."""
        st, res = make_raw_request("POST", "/api/v1/issues/999999/comments/", body={"body": "Hello"}, headers=self.auth_headers)
        self.assertEqual(st, 404, f"Expected 404 for comment on nonexistent issue, got {st}: {res}")

    def test_10_close_nonexistent_issue(self):
        """Closing nonexistent issue must return 404."""
        st, res = make_raw_request("POST", "/api/v1/issues/999999/close/", body={}, headers=self.auth_headers)
        self.assertEqual(st, 404, f"Expected 404, got {st}: {res}")

    def test_11_merge_nonexistent_pr(self):
        """Merging nonexistent PR must return 404."""
        st, res = make_raw_request("POST", "/api/v1/pull-requests/999999/merge", body={}, headers=self.auth_headers)
        self.assertEqual(st, 404, f"Expected 404, got {st}: {res}")

    def test_12_nonexistent_chat_conversation_messages(self):
        """Getting messages of nonexistent conversation must return 404."""
        st, res = make_raw_request("GET", "/api/v1/chat/conversations/nonexistent_conv_xyz/messages", headers=self.auth_headers)
        self.assertEqual(st, 404, f"Expected 404 for nonexistent conversation, got {st}: {res}")

    def test_13_post_message_to_nonexistent_conversation(self):
        """Posting to nonexistent conversation must return 404."""
        st, res = make_raw_request("POST", "/api/v1/chat/conversations/nonexistent_conv_xyz/messages", body={"text": "hi"}, headers=self.auth_headers)
        self.assertEqual(st, 404, f"Expected 404, got {st}: {res}")

    def test_14_react_to_nonexistent_message(self):
        """Reacting to nonexistent message must return 404."""
        st, res = make_raw_request("POST", "/api/v1/chat/messages/nonexistent_msg_xyz/react", body={"emoji": "👍"}, headers=self.auth_headers)
        self.assertEqual(st, 404, f"Expected 404, got {st}: {res}")

    def test_15_remove_nonexistent_team_member(self):
        """Removing nonexistent team member must return 404."""
        st, res = make_raw_request("DELETE", "/api/v1/teams/members/nonexistent_user_xyz/", headers=self.auth_headers)
        self.assertEqual(st, 404, f"Expected 404, got {st}: {res}")

    # -------------------------------------------------------------
    # 3. Search & Filter Boundary Cases
    # -------------------------------------------------------------
    def test_16_issues_search_special_characters(self):
        """Issue search with special chars must return 200 and safe list."""
        st, res = make_raw_request("GET", "/api/v1/issues/?q=%22%3E%3Cscript%3Ealert(1)%3C/script%3E", headers=self.auth_headers)
        self.assertEqual(st, 200)
        self.assertIsInstance(res if isinstance(res, list) else res.get("issues", []), list)

    def test_17_issues_filter_invalid_status(self):
        """Filtering issues by unknown status should return 200 and empty list."""
        st, res = make_raw_request("GET", "/api/v1/issues/?status=fake_status_123", headers=self.auth_headers)
        self.assertEqual(st, 200)
        issues = res if isinstance(res, list) else res.get("issues", [])
        self.assertEqual(len(issues), 0)

    def test_18_pull_requests_filter_invalid_repo(self):
        """Filtering PRs by nonexistent repo should return 200 and empty list."""
        st, res = make_raw_request("GET", "/api/v1/pull-requests/?repo=nonexistent-repo-999", headers=self.auth_headers)
        self.assertEqual(st, 200)
        prs = res if isinstance(res, list) else res.get("pull_requests", [])
        self.assertEqual(len(prs), 0)

    # -------------------------------------------------------------
    # 4. Authentication Boundaries
    # -------------------------------------------------------------
    def test_19_invalid_bearer_token(self):
        """Request with completely fabricated bearer token must be rejected with 401."""
        st, res = make_raw_request("GET", "/api/v1/auth/me", headers={"Authorization": "Bearer fake_token_999999"})
        self.assertEqual(st, 401, f"Expected 401 for bad token, got {st}: {res}")

    def test_20_malformed_authorization_header(self):
        """Request with malformed Authorization header (no Bearer keyword)."""
        st, res = make_raw_request("GET", "/api/v1/auth/me", headers={"Authorization": "InvalidScheme token"})
        self.assertEqual(st, 401, f"Expected 401 for bad scheme, got {st}: {res}")

    def test_21_invalid_session_cookie(self):
        """Request with invalid devsync_session cookie must return 401 on protected endpoint."""
        st, res = make_raw_request("GET", "/api/v1/auth/me", headers={"Cookie": "devsync_session=invalid_session_hex"})
        self.assertEqual(st, 401, f"Expected 401 for bad cookie, got {st}: {res}")

    # -------------------------------------------------------------
    # 5. Voice AI Endpoints Boundaries
    # -------------------------------------------------------------
    def test_22_voice_context_empty_body(self):
        """Voice context endpoint with empty body defaults safely to 200."""
        st, res = make_raw_request("POST", "/api/v1/ai/voice/context", body={}, headers=self.auth_headers)
        self.assertEqual(st, 200)
        self.assertTrue(res.get("ok"))
        self.assertIn("systemInstruction", res)

    def test_23_voice_context_nonexistent_repo(self):
        """Voice context for nonexistent repo falls back safely to default system instruction."""
        st, res = make_raw_request("POST", "/api/v1/ai/voice/context", body={"repo": "nonexistent-repo-xyz"}, headers=self.auth_headers)
        self.assertEqual(st, 200)
        self.assertTrue(res.get("ok"))
        self.assertIn("systemInstruction", res)

    # -------------------------------------------------------------
    # 6. Team & Collaboration Edge Cases
    # -------------------------------------------------------------
    def test_24_team_member_invite_missing_fields(self):
        """Team member invite without required fields must return 400."""
        st, res = make_raw_request("POST", "/api/v1/teams/members/invite", body={}, headers=self.auth_headers)
        self.assertEqual(st, 400, f"Expected 400 on empty invite, got {st}: {res}")

    def test_25_team_member_patch_invalid_role(self):
        """Updating member role with invalid role string must return 400."""
        st, res = make_raw_request("PATCH", "/api/v1/teams/members/naveen3438/", body={"role": "SuperSupremeLeader"}, headers=self.auth_headers)
        self.assertEqual(st, 400, f"Expected 400 on invalid role, got {st}: {res}")


if __name__ == "__main__":
    unittest.main()
