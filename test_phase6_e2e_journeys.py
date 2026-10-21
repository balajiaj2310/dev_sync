"""
DevSync Phase 6 End-to-End (E2E) User Journeys & Integration Suite
Simulates realistic, unbypassed multi-step developer workflows:
1. Journey A: Authentication, Session Management, and Security Audit
2. Journey B: Profile Customization & Settings Persistence
3. Journey C: Repository Exploration & Contribution Intelligence
4. Journey D: Complete Issue Lifecycle (Create -> Comment -> Filter -> Close -> Reopen)
5. Journey E: Complete Pull Request Lifecycle (Create -> Review -> Merge)
6. Journey F: Team Collaboration & Real-Time Discussion (Chat -> Reaction -> Role Management)
7. Journey G: Notifications Lifecycle & Voice AI Integration
8. Journey H: Session Revocation & Complete Sign-Out Verification
"""

import unittest
import urllib.request
import urllib.parse
import urllib.error
import json
import time

BASE_URL = "http://127.0.0.1:8000"


def send_req(method, path, data=None, token=None, custom_headers=None, timeout=25):
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
        with urllib.request.urlopen(req, timeout=timeout) as resp:
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


class TestPhase6E2EJourneys(unittest.TestCase):
    """Full End-to-End Journey Verification."""

    # -------------------------------------------------------------
    # Journey A: Auth, Session Token, and Profile Verification
    # -------------------------------------------------------------
    def test_journey_a_auth_and_session(self):
        # 1. Login with valid credentials
        st, res = send_req("POST", "/api/v1/auth/login", {
            "email": "naveen@devsync.dev",
            "password": "demo12345"
        })
        self.assertEqual(st, 200, f"Login failed: {res}")
        self.assertTrue(res.get("success"), "Expected success=True")
        token = res.get("token") or res.get("access")
        self.assertTrue(token, "Missing token in response")

        # 2. Fetch authenticated user profile
        st_me, me = send_req("GET", "/api/v1/auth/me", token=token)
        self.assertEqual(st_me, 200)
        self.assertEqual(me.get("username"), "naveen3438")
        self.assertEqual(me.get("email"), "naveen@devsync.dev")

        # 3. Check active sessions list
        st_sess, sessions = send_req("GET", "/api/v1/settings/sessions", token=token)
        self.assertEqual(st_sess, 200)
        self.assertIsInstance(sessions, list)
        self.assertGreaterEqual(len(sessions), 1)

    # -------------------------------------------------------------
    # Journey B: Profile Customization & Settings Persistence
    # -------------------------------------------------------------
    def test_journey_b_profile_update_and_persistence(self):
        # Authenticate
        st, res = send_req("POST", "/api/v1/auth/login", {
            "email": "naveen@devsync.dev",
            "password": "demo12345"
        })
        token = res.get("token") or res.get("access")

        # Update profile headline & bio
        new_headline = "BCA Student & Lead Architect at DevSync (E2E Verified)"
        st_up, up_res = send_req("PATCH", "/api/v1/settings/profile", {
            "headline": new_headline,
            "location": "Bengaluru, Karnataka, India"
        }, token=token)
        self.assertEqual(st_up, 200, f"Profile update failed: {up_res}")

        # Verify update persists on public profile endpoint
        st_pub, pub_prof = send_req("GET", "/api/v1/u/naveen3438")
        self.assertEqual(st_pub, 200)
        self.assertEqual(pub_prof.get("headline"), new_headline)
        self.assertEqual(pub_prof.get("location"), "Bengaluru, Karnataka, India")

    # -------------------------------------------------------------
    # Journey C: Repository Exploration & Contribution Intelligence
    # -------------------------------------------------------------
    def test_journey_c_repo_and_contribution_intelligence(self):
        # Authenticate
        st, res = send_req("POST", "/api/v1/auth/login", {
            "email": "balaji@devsync.dev",
            "password": "demo12345"
        })
        token = res.get("token") or res.get("access")

        # Browse repositories
        st_repos, repos = send_req("GET", "/api/v1/repositories", token=token)
        self.assertEqual(st_repos, 200)
        self.assertIsInstance(repos, list)
        self.assertGreaterEqual(len(repos), 1)

        repo_names = [r.get("name") for r in repos]
        self.assertIn("devsync-core", repo_names)

        # Fetch specific repository details
        st_core, core_repo = send_req("GET", "/api/v1/repositories/devsync-core", token=token)
        self.assertEqual(st_core, 200)
        self.assertEqual(core_repo.get("name"), "devsync-core")

        # Fetch contribution intelligence for user
        st_pulse, pulse = send_req("GET", "/api/v1/analytics/contribution-intelligence?username=balajikumar", token=token)
        self.assertEqual(st_pulse, 200)
        self.assertIn("score", pulse)
        self.assertIn("summary", pulse)
        self.assertIn("indicators", pulse)
        self.assertGreaterEqual(pulse["score"], 0)

    # -------------------------------------------------------------
    # Journey D: Issue Lifecycle (Create -> Comment -> Filter -> Close -> Reopen)
    # -------------------------------------------------------------
    def test_journey_d_issue_lifecycle(self):
        st, res = send_req("POST", "/api/v1/auth/login", {
            "email": "balaji@devsync.dev",
            "password": "demo12345"
        })
        token = res.get("token") or res.get("access")
        headers = {"X-DevSync-User": "balajikumar"}

        # 1. Create a new issue
        issue_title = f"E2E Integration Test Issue {int(time.time())}"
        st_create, created_issue = send_req("POST", "/api/v1/issues/", {
            "title": issue_title,
            "description": "Automated E2E test verifying full issue lifecycle.",
            "repository": "devsync-core",
            "labels": ["bug", "e2e-test"]
        }, token=token, custom_headers=headers)
        self.assertIn(st_create, (200, 201), f"Create issue failed: {created_issue}")
        issue_id = created_issue.get("id") or created_issue.get("number")
        self.assertTrue(issue_id, f"Missing issue id: {created_issue}")

        # 2. Add a comment to the issue
        st_comm, comm_res = send_req("POST", f"/api/v1/issues/{issue_id}/comments/", {
            "comment": "Reproduced and verified in staging test environment."
        }, token=token, custom_headers=headers)
        self.assertIn(st_comm, (200, 201), f"Add comment failed: {comm_res}")

        # 3. Filter issues by repository and search term
        st_filter, filtered = send_req("GET", f"/api/v1/issues/?repo=devsync-core&q={urllib.parse.quote(issue_title)}", token=token)
        self.assertEqual(st_filter, 200)
        items = filtered if isinstance(filtered, list) else filtered.get("results", [])
        found = any(i.get("title") == issue_title for i in items)
        self.assertTrue(found, "Created issue was not found in filtered search query")

        # 4. Close the issue
        st_close, close_res = send_req("POST", f"/api/v1/issues/{issue_id}/close/", {}, token=token, custom_headers=headers)
        self.assertEqual(st_close, 200, f"Close issue failed: {close_res}")
        st_get, updated_issue = send_req("GET", f"/api/v1/issues/{issue_id}/", token=token)
        self.assertEqual(st_get, 200)
        self.assertEqual(str(updated_issue.get("status")).lower(), "closed")

        # 5. Reopen the issue
        st_reopen, reopen_res = send_req("POST", f"/api/v1/issues/{issue_id}/reopen/", {}, token=token, custom_headers=headers)
        self.assertEqual(st_reopen, 200, f"Reopen issue failed: {reopen_res}")
        st_get2, reopened_issue = send_req("GET", f"/api/v1/issues/{issue_id}/", token=token)
        self.assertEqual(st_get2, 200)
        self.assertEqual(str(reopened_issue.get("status")).lower(), "open")

    # -------------------------------------------------------------
    # Journey E: Pull Request Lifecycle (Create -> Comment/Review -> Merge)
    # -------------------------------------------------------------
    def test_journey_e_pull_request_lifecycle(self):
        st, res = send_req("POST", "/api/v1/auth/login", {
            "email": "naveen@devsync.dev",
            "password": "demo12345"
        })
        token = res.get("token") or res.get("access")
        headers = {"X-DevSync-User": "naveen3438"}

        # 1. Create a pull request
        pr_title = f"E2E Integration PR {int(time.time())}"
        st_create, created_pr = send_req("POST", "/api/v1/pull-requests/", {
            "title": pr_title,
            "description": "Comprehensive E2E verification PR for automated testing.",
            "repository": "devsync-core",
            "source_branch": "feature/authentication",
            "target_branch": "main"
        }, token=token, custom_headers=headers)
        self.assertIn(st_create, (200, 201), f"Create PR failed: {created_pr}")
        pr_id = created_pr.get("id") or created_pr.get("number")
        self.assertTrue(pr_id, f"Missing PR id: {created_pr}")

        # 2. Add review comment to PR
        st_comm, comm_res = send_req("POST", f"/api/v1/pull-requests/{pr_id}/review/", {
            "action": "comment",
            "comment": "Code review looks great. All test suites passing. Ready for merge."
        }, token=token, custom_headers=headers)
        self.assertIn(st_comm, (200, 201), f"Add PR comment failed: {comm_res}")

        # 3. Merge the PR
        st_merge, merge_res = send_req("POST", f"/api/v1/pull-requests/{pr_id}/merge/", {}, token=token, custom_headers=headers)
        self.assertEqual(st_merge, 200, f"Merge PR failed: {merge_res}")

        # 4. Verify PR is now merged
        st_get, merged_pr = send_req("GET", f"/api/v1/pull-requests/{pr_id}/", token=token)
        self.assertEqual(st_get, 200)
        self.assertEqual(str(merged_pr.get("status")).lower(), "merged")

    # -------------------------------------------------------------
    # Journey F: Team Collaboration & Real-Time Discussions
    # -------------------------------------------------------------
    def test_journey_f_team_and_discussion(self):
        st, res = send_req("POST", "/api/v1/auth/login", {
            "email": "naveen@devsync.dev",
            "password": "demo12345"
        })
        token = res.get("token") or res.get("access")
        headers = {"X-DevSync-User": "naveen3438"}

        # 1. List team members
        st_members, members = send_req("GET", "/api/v1/teams/members/", token=token)
        self.assertEqual(st_members, 200)
        self.assertIsInstance(members, list)
        self.assertGreaterEqual(len(members), 1)

        # 2. Update a team member's role (valid role)
        st_role, role_res = send_req("PATCH", "/api/v1/teams/members/balajikumar/", {
            "role": "Maintainer"
        }, token=token, custom_headers=headers)
        self.assertEqual(st_role, 200, f"Update role failed: {role_res}")

        # 3. Send discussion chat message to channel
        st_msg, msg_res = send_req("POST", "/api/v1/community/channels/ch-general/messages/", {
            "content": f"Automated E2E discussion message {int(time.time())}"
        }, token=token, custom_headers=headers)
        self.assertIn(st_msg, (200, 201), f"Send chat failed: {msg_res}")
        msg_id = msg_res.get("id")
        self.assertTrue(msg_id, f"Missing message id: {msg_res}")

        # 4. React to discussion message
        st_react, react_res = send_req("POST", f"/api/v1/chat/messages/{msg_id}/react/", {
            "emoji": "🚀"
        }, token=token, custom_headers=headers)
        self.assertEqual(st_react, 200, f"Add reaction failed: {react_res}")

        # 5. Fetch channel messages and verify reaction is included
        st_ch, ch_msgs = send_req("GET", "/api/v1/community/channels/ch-general/messages/", token=token)
        self.assertEqual(st_ch, 200)
        found_msg = next((m for m in ch_msgs if m.get("id") == msg_id), None)
        self.assertIsNotNone(found_msg, "Sent discussion message not found in channel")
        reactions = found_msg.get("reactions", {})
        self.assertIn("🚀", reactions)

    # -------------------------------------------------------------
    # Journey G: Notifications Lifecycle & Voice AI
    # -------------------------------------------------------------
    def test_journey_g_notifications_and_voice_ai(self):
        st, res = send_req("POST", "/api/v1/auth/login", {
            "email": "naveen@devsync.dev",
            "password": "demo12345"
        })
        token = res.get("token") or res.get("access")

        # 1. Fetch user notifications
        st_notif, notif_data = send_req("GET", "/api/v1/notifications", token=token)
        self.assertEqual(st_notif, 200)
        self.assertIsInstance(notif_data, dict)
        notifs = notif_data.get("notifications", [])
        self.assertIsInstance(notifs, list)

        # 2. Query Voice AI assistant context endpoint
        st_voice, voice_ctx = send_req("GET", "/api/v1/ai/voice/context?repo=devsync-core&branch=main", token=token)
        self.assertEqual(st_voice, 200, f"Voice AI context failed: {voice_ctx}")
        sys_inst = voice_ctx.get("systemInstruction") or voice_ctx.get("system_instruction")
        self.assertTrue(sys_inst, "Voice AI system instruction should be returned")
        self.assertIn("devsync-core", sys_inst)

    # -------------------------------------------------------------
    # Journey H: Logout & Session Termination
    # -------------------------------------------------------------
    def test_journey_h_logout_and_session_invalidation(self):
        # 1. Login with credentials
        st, res = send_req("POST", "/api/v1/auth/login", {
            "email": "balaji@devsync.dev",
            "password": "demo12345"
        })
        self.assertEqual(st, 200)
        token = res.get("token") or res.get("access")

        # 2. Check that authenticated endpoint works with this token
        st_me, me = send_req("GET", "/api/v1/auth/me", token=token)
        self.assertEqual(st_me, 200)
        self.assertEqual(me.get("username"), "balajikumar")

        # 3. Call logout endpoint
        st_out, out_res = send_req("POST", "/api/v1/auth/logout", {}, token=token)
        self.assertEqual(st_out, 200)

        # 4. Verify that the revoked token can NO LONGER access authenticated endpoints
        st_after, after_res = send_req("GET", "/api/v1/auth/me", token=token)
        self.assertEqual(st_after, 401, f"Expected 401 after logout, got {st_after}: {after_res}")


if __name__ == "__main__":
    unittest.main()
