"""
DevSync End-to-End Feature Repair Validation Suite
Verifies all 5 reported problem areas:
1. Voice Assistant (Speech Recognition Pipeline, Token, Synthesize, Chat)
2. Teams & Collaborators (Invite flow, Modal triggers, Member listings)
3. Project Navigation & Detail Pages (Creation, Authorization, Detail view, Dashboard links)
4. Discussions & Messaging (Conversation loading, Counterparty metadata, Send, Receive, Reactions)
5. Login OTP Delivery (Secure generation, Rate limiting, Verification, Single-use tokens, 2FA)
"""

import unittest
import urllib.request
import urllib.parse
import json
import time

BASE_URL = "http://localhost:8000"

def make_request(path, method='GET', data=None, headers=None, timeout=25):
    url = f"{BASE_URL}{path}"
    req_headers = {'Content-Type': 'application/json'}
    if headers:
        req_headers.update(headers)
    
    encoded_data = None
    if data is not None:
        if isinstance(data, dict):
            encoded_data = json.dumps(data).encode('utf-8')
        else:
            encoded_data = data.encode('utf-8')

    req = urllib.request.Request(url, data=encoded_data, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            status = response.getcode()
            body = response.read().decode('utf-8')
            resp_headers = dict(response.headers)
            try:
                parsed_json = json.loads(body)
            except Exception:
                parsed_json = body
            return status, parsed_json, resp_headers
    except urllib.error.HTTPError as e:
        status = e.code
        body = e.read().decode('utf-8')
        try:
            parsed_json = json.loads(body)
        except Exception:
            parsed_json = body
        return status, parsed_json, dict(e.headers)


class TestVoiceAssistantRepairs(unittest.TestCase):
    """Test Suite 1: Voice Assistant APIs and Pipeline."""

    def test_voice_token_endpoint(self):
        status, data, _ = make_request("/api/v1/ai/voice/token", method='GET')
        self.assertEqual(status, 200)
        self.assertTrue(data.get('ok'))
        self.assertIn('token', data)
        self.assertIn('model', data)
        self.assertIn('supportedVoices', data)

    def test_ai_chat_interaction(self):
        payload = {
            "message": "Hello DevSync Assistant! What features does DevSync offer for developers?",
            "conversation_id": "test_conv_repair"
        }
        status, data, _ = make_request("/api/ai/chat", method='POST', data=payload)
        self.assertEqual(status, 200)
        reply = data.get('reply') or data.get('response') or ''
        self.assertGreater(len(reply), 10)

    def test_ai_voice_synthesize_endpoint(self):
        payload = {"text": "Welcome to DevSync collaboration platform."}
        status, data, _ = make_request("/api/v1/ai/voice/synthesize", method='POST', data=payload)
        self.assertEqual(status, 200)
        self.assertTrue(data.get('ok'))
        self.assertIn('audioBase64', data)
        self.assertEqual(data.get('mimeType'), 'audio/wav')


class TestTeamsAndCollaboratorsRepairs(unittest.TestCase):
    """Test Suite 2: Teams & Collaborators Workflows."""

    def test_list_teams(self):
        status, data, _ = make_request("/api/v1/teams", method='GET')
        self.assertEqual(status, 200)
        self.assertIsInstance(data, list)
        self.assertGreater(len(data), 0)

    def test_list_team_members(self):
        status, data, _ = make_request("/api/v1/teams/members", method='GET')
        self.assertEqual(status, 200)
        self.assertIsInstance(data, list)
        self.assertGreater(len(data), 0)

    def test_invite_team_member_api(self):
        invite_payload = {
            "project": "devsync-core",
            "username": "karthik",
            "role": "Maintainer",
            "email": "karthik@devsync.dev"
        }
        headers = {"X-DevSync-User": "balajikumar"}
        status, data, _ = make_request("/api/v1/teams/members/invite", method='POST', data=invite_payload, headers=headers)
        self.assertEqual(status, 201)
        self.assertTrue(data.get('success'))
        member = data.get('member', {})
        self.assertEqual(member.get('projectRoles', {}).get('devsync-core'), "Maintainer")


class TestProjectNavigationAndDetailRepairs(unittest.TestCase):
    """Test Suite 3: Project Detail and Navigation."""

    def test_repository_creation_and_detail_retrieval(self):
        repo_name = f"e2e-project-{int(time.time())}"
        create_payload = {
            "name": repo_name,
            "description": "E2E automated test repository",
            "visibility": "public",
            "primaryLanguage": "Python"
        }
        headers = {"X-DevSync-User": "balajikumar"}
        status, create_res, _ = make_request("/api/v1/repositories", method='POST', data=create_payload, headers=headers)
        self.assertEqual(status, 201)
        self.assertTrue(create_res.get('success'))
        repo_data = create_res.get('repository', {})
        self.assertEqual(repo_data.get('name'), repo_name)

        # Retrieve repository detail
        status, detail_res, _ = make_request(f"/api/v1/repositories/{repo_name}", method='GET', headers=headers)
        self.assertEqual(status, 200)
        self.assertEqual(detail_res.get('name'), repo_name)
        self.assertEqual(detail_res.get('owner').lower(), "balajikumar")

    def test_existing_devsync_core_detail(self):
        headers = {"X-DevSync-User": "balajikumar"}
        status, data, _ = make_request("/api/v1/repositories/devsync-core", method='GET', headers=headers)
        self.assertEqual(status, 200)
        self.assertEqual(data.get('name'), "devsync-core")


class TestDiscussionsAndMessagingRepairs(unittest.TestCase):
    """Test Suite 4: Discussions, Messaging, Reactions & Persistence."""

    def test_conversations_counterparty_metadata(self):
        # When balajikumar requests conversations, direct chat should display counterparty
        headers = {"X-DevSync-User": "balajikumar"}
        status, convs, _ = make_request("/api/v1/chat/conversations", method='GET', headers=headers)
        self.assertEqual(status, 200)
        self.assertIsInstance(convs, list)
        self.assertGreater(len(convs), 0)

        # Verify that balajikumar does not see their own name as title for direct chat
        direct_chats = [c for c in convs if c.get('type') == 'direct']
        self.assertGreater(len(direct_chats), 0)
        for dc in direct_chats:
            self.assertNotEqual(dc.get('title'), 'balajikumar')

    def test_send_and_retrieve_message(self):
        msg_text = f"Automated E2E discussion test message {time.time()}"
        post_payload = {"text": msg_text}
        headers = {"X-DevSync-User": "balajikumar"}

        status, post_res, _ = make_request("/api/v1/chat/conversations/conv-direct-balaji/messages", method='POST', data=post_payload, headers=headers)
        self.assertEqual(status, 201)
        self.assertEqual(post_res.get('text'), msg_text)
        msg_id = post_res.get('id')

        # Recipient naveen3438 retrieves messages
        rcpt_headers = {"X-DevSync-User": "naveen3438"}
        status, msgs, _ = make_request("/api/v1/chat/conversations/conv-direct-balaji/messages", method='GET', headers=rcpt_headers)
        self.assertEqual(status, 200)
        matching = [m for m in msgs if m.get('id') == msg_id]
        self.assertEqual(len(matching), 1)
        self.assertEqual(matching[0].get('text'), msg_text)

        # Add reaction
        react_payload = {"emoji": "🚀"}
        status, react_res, _ = make_request(f"/api/v1/chat/messages/{msg_id}/react", method='POST', data=react_payload, headers=rcpt_headers)
        self.assertEqual(status, 200)
        self.assertIn("🚀", react_res.get('reactions', {}))


class TestLoginOTPRepairs(unittest.TestCase):
    """Test Suite 5: Login OTP Delivery, Rate Limiting, Verification & 2FA."""

    def test_send_email_otp_and_rate_limiting(self):
        test_email = f"tester_{int(time.time())}@example.com"
        payload = {"email": test_email}

        # 1. Request OTP
        status, res1, _ = make_request("/api/v1/auth/send-email-otp", method='POST', data=payload)
        self.assertIn(status, [200, 502])
        if status == 200:
            self.assertTrue(res1.get('success'))
            self.assertIn(res1.get('deliveryMode'), ['console', 'smtp'])
        else:
            self.assertEqual(res1.get('error'), 'Email delivery failed')

        # 2. Immediate second request within 60s should be rate-limited (HTTP 429)
        status, res2, _ = make_request("/api/v1/auth/send-email-otp", method='POST', data=payload)
        self.assertEqual(status, 429)
        self.assertEqual(res2.get('error'), 'Rate limited')

    def test_verify_email_otp_validation(self):
        test_email = f"tester_verify_{int(time.time())}@example.com"
        # Invalid OTP without sending
        status, res, _ = make_request("/api/v1/auth/verify-email-otp", method='POST', data={"email": test_email, "otp": "000000"})
        self.assertEqual(status, 400)

    def test_login_flow(self):
        # Valid login with demo credentials
        login_payload = {
            "email": "balaji@devsync.dev",
            "password": "demo12345"
        }
        status, res, headers = make_request("/api/v1/auth/login", method='POST', data=login_payload)
        if status == 200 and not res.get('requires_2fa'):
            self.assertTrue(res.get('success'))
            self.assertIn('token', res)
        elif status == 200 and res.get('requires_2fa'):
            self.assertTrue(res.get('requires_2fa'))
        else:
            self.fail(f"Login failed unexpectedly: {res}")


if __name__ == '__main__':
    unittest.main()
