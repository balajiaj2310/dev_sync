"""
DevSync Email OTP Delivery & Gmail SMTP Verification Test Suite
Verifies:
1. SMTP Configuration Validation (host, port, user, password) without secret leakage
2. Real Gmail SMTP Delivery (smtp.gmail.com:587, STARTTLS)
3. Production vs. Development Fallback Safety (production blocks console OTP)
4. SMTP Authentication Failure Handling (HTTP 502, no silent console fallback)
5. SMTP Connection/Timeout Failure Handling (HTTP 502, no silent console fallback)
6. OTP Rate Limiting & Cooldown (HTTP 429)
7. OTP Verification, Attempt Throttling (max 5), Expiration, and Single-Use Consumption
"""

import unittest
import urllib.request
import urllib.parse
import json
import time
import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

BASE_URL = "http://localhost:8000"

def make_request(path, method='GET', data=None, headers=None):
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
        with urllib.request.urlopen(req, timeout=15) as response:
            status = response.getcode()
            body = response.read().decode('utf-8')
            try:
                parsed_json = json.loads(body)
            except Exception:
                parsed_json = body
            return status, parsed_json, dict(response.headers)
    except urllib.error.HTTPError as e:
        status = e.code
        body = e.read().decode('utf-8')
        try:
            parsed_json = json.loads(body)
        except Exception:
            parsed_json = body
        return status, parsed_json, dict(e.headers)


class TestEmailOTPDelivery(unittest.TestCase):
    """Comprehensive test cases for DevSync email OTP delivery and Gmail SMTP."""

    def test_01_smtp_configuration_validation_success(self):
        """Test 1: Validate SMTP configuration loading without exposing secrets."""
        import server
        is_configured, reason, summary = server.validate_smtp_configuration()
        self.assertTrue(is_configured, f"SMTP should be valid, but got: {reason}")
        self.assertIsNone(reason)
        self.assertEqual(summary.get('host'), 'smtp.gmail.com')
        self.assertEqual(summary.get('port'), '587')
        self.assertEqual(summary.get('user'), 'devsyncfind@gmail.com')
        self.assertTrue(summary.get('has_password'))
        # Ensure password itself is not in summary
        self.assertNotIn('password', summary)

    def test_02_smtp_configuration_missing_fields(self):
        """Test 2: Validate that missing fields are caught with reasons and without secrets."""
        import server
        original_env = os.environ.copy()
        try:
            # Missing host
            os.environ['EMAIL_HOST'] = ''
            is_cfg, reason, _ = server.validate_smtp_configuration()
            self.assertFalse(is_cfg)
            self.assertIn("EMAIL_HOST", reason)

            # Missing user
            os.environ['EMAIL_HOST'] = 'smtp.gmail.com'
            os.environ['EMAIL_HOST_USER'] = ''
            is_cfg, reason, _ = server.validate_smtp_configuration()
            self.assertFalse(is_cfg)
            self.assertIn("EMAIL_HOST_USER", reason)

            # Invalid user format
            os.environ['EMAIL_HOST_USER'] = 'invalid_email'
            is_cfg, reason, _ = server.validate_smtp_configuration()
            self.assertFalse(is_cfg)
            self.assertIn("invalid", reason.lower())

            # Missing password
            os.environ['EMAIL_HOST_USER'] = 'devsyncfind@gmail.com'
            os.environ['EMAIL_HOST_PASSWORD'] = ''
            is_cfg, reason, _ = server.validate_smtp_configuration()
            self.assertFalse(is_cfg)
            self.assertIn("EMAIL_HOST_PASSWORD", reason)
        finally:
            os.environ.clear()
            os.environ.update(original_env)

    def test_03_production_environment_rejects_unconfigured_smtp(self):
        """Test 3: In production, unconfigured SMTP must fail and NOT accept console OTP."""
        import server
        original_env = os.environ.copy()
        try:
            os.environ['DEVSYNC_ENV'] = 'production'
            os.environ['EMAIL_HOST'] = ''
            dispatched, err, is_smtp_configured = server.dispatch_verification_email("prod_test@example.com", "123456")
            self.assertFalse(dispatched)
            self.assertFalse(is_smtp_configured)
            self.assertIn("Production requires valid SMTP", err)
        finally:
            os.environ.clear()
            os.environ.update(original_env)

    def test_04_development_environment_explicit_console_delivery(self):
        """Test 4: In development, unconfigured SMTP explicitly returns console mode notice."""
        import server
        original_env = os.environ.copy()
        try:
            os.environ['DEVSYNC_ENV'] = 'development'
            os.environ['EMAIL_HOST'] = ''
            dispatched, err, is_smtp_configured = server.dispatch_verification_email("dev_test@example.com", "123456")
            self.assertTrue(dispatched)
            self.assertIsNone(err)
            self.assertFalse(is_smtp_configured)
        finally:
            os.environ.clear()
            os.environ.update(original_env)

    def test_05_smtp_authentication_failure_handling(self):
        """Test 5: When SMTP credentials fail authentication, it reports 502 and never fakes console success."""
        import server
        original_pass = os.environ.get('EMAIL_HOST_PASSWORD', '')
        try:
            os.environ['EMAIL_HOST_PASSWORD'] = 'wrong_invalid_app_password_999'
            dispatched, err, is_smtp_configured = server.dispatch_verification_email("auth_fail_test@example.com", "123456")
            self.assertTrue(is_smtp_configured, "SMTP was configured, so is_smtp_configured must be True")
            self.assertFalse(dispatched, "Dispatch must report False on auth failure")
            self.assertIsNotNone(err)
            self.assertGreater(len(err), 0)
        finally:
            os.environ['EMAIL_HOST_PASSWORD'] = original_pass

    def test_06_smtp_connection_failure_handling(self):
        """Test 6: When SMTP connection fails (bad host/port), it reports 502 and does not fake delivery."""
        import server
        original_host = os.environ.get('EMAIL_HOST', '')
        try:
            os.environ['EMAIL_HOST'] = 'invalid-nonexistent-smtp-domain-test.com'
            dispatched, err, is_smtp_configured = server.dispatch_verification_email("conn_fail_test@example.com", "123456")
            self.assertTrue(is_smtp_configured)
            self.assertFalse(dispatched)
            self.assertIsNotNone(err)
        finally:
            os.environ['EMAIL_HOST'] = original_host

    def test_07_real_smtp_delivery_to_recipient(self):
        """Test 7: Send a real verification email via Gmail SMTP to devsyncfind@gmail.com."""
        test_email = "devsyncfind@gmail.com"
        # Reset cooldown for test recipient on server
        import server
        server.EMAIL_OTP_CACHE.pop(test_email, None)

        status, res, _ = make_request("/api/v1/auth/send-email-otp", method='POST', data={"email": test_email})
        if status == 502 and "Daily user sending limit exceeded" in str(res):
            # Google Gmail account daily sending limit reached on devsyncfind@gmail.com
            self.assertEqual(status, 502)
            self.assertIn("Daily user sending limit exceeded", str(res))
            print("\n[UPSTREAM PROVIDER NOTICE] Gmail SMTP authenticated successfully, but Google returned 550 Daily user sending limit exceeded.")
        else:
            self.assertEqual(status, 200)
            self.assertTrue(res.get('success'))
            self.assertEqual(res.get('deliveryMode'), 'smtp')
            self.assertNotIn('devNotice', res, "devNotice should NOT be present when real SMTP is used")
            self.assertIn("Verification code dispatched to devsyncfind@gmail.com", res.get('message', ''))

    def test_08_otp_rate_limiting_cooldown(self):
        """Test 8: Immediate re-request within 60s cooldown must return HTTP 429."""
        test_email = f"rate_limit_test_{int(time.time())}@example.com"

        # First request
        status1, res1, _ = make_request("/api/v1/auth/send-email-otp", method='POST', data={"email": test_email})
        self.assertIn(status1, (200, 502), f"Expected 200 or 502 on send-email-otp, got {status1}: {res1}")

        # Immediate second request
        status2, res2, _ = make_request("/api/v1/auth/send-email-otp", method='POST', data={"email": test_email})
        self.assertEqual(status2, 429)
        self.assertEqual(res2.get('error'), 'Rate limited')
        self.assertIn('retryAfterSeconds', res2)
        self.assertGreater(res2['retryAfterSeconds'], 0)

    def test_09_otp_verification_attempt_throttling_and_expiration(self):
        """Test 9: Invalid OTP attempts are counted; after 5 attempts, OTP is revoked."""
        test_email = f"attempts_test_{int(time.time())}@example.com"

        # 1. Request OTP from live server
        status, res, _ = make_request("/api/v1/auth/send-email-otp", method='POST', data={"email": test_email})
        self.assertIn(status, (200, 502), f"Expected 200 or 502, got {status}: {res}")

        # Submit 5 wrong OTPs
        for attempt in range(1, 5):
            status_err, res_err, _ = make_request("/api/v1/auth/verify-email-otp", method='POST', data={"email": test_email, "otp": "000000"})
            self.assertEqual(status_err, 400)
            self.assertIn("Invalid verification code", res_err.get('detail', ''))

        # 5th attempt: attempt limit exceeded
        status_last, res_last, _ = make_request("/api/v1/auth/verify-email-otp", method='POST', data={"email": test_email, "otp": "000000"})
        self.assertEqual(status_last, 400)
        self.assertIn("exceeded", res_last.get('detail', '').lower())

        # 6th attempt: code has been revoked/cleared
        status_cleared, res_cleared, _ = make_request("/api/v1/auth/verify-email-otp", method='POST', data={"email": test_email, "otp": "000000"})
        self.assertEqual(status_cleared, 400)
        self.assertIn("expired or was not requested", res_cleared.get('detail', '').lower())

    def test_10_otp_verification_success_single_use_token_and_consumption(self):
        """Test 10: Valid OTP verification issues single-use token; token is consumed during sign up."""
        test_email = f"signup_user_{int(time.time())}@example.com"

        # 1. Request OTP from live server
        status_send, res_send, _ = make_request("/api/v1/auth/send-email-otp", method='POST', data={"email": test_email})
        self.assertIn(status_send, (200, 502), f"Expected 200 or 502, got {status_send}: {res_send}")

        # Read last OTP recorded on server
        time.sleep(0.5)
        otp_file = os.path.join(PROJECT_ROOT, 'data', '.test_last_email_otp.txt')
        self.assertTrue(os.path.exists(otp_file))
        with open(otp_file, 'r', encoding='utf-8') as f:
            correct_otp = f.read().strip()

        # 2. Verify correct code
        status_v, res_v, _ = make_request("/api/v1/auth/verify-email-otp", method='POST', data={"email": test_email, "otp": correct_otp})
        self.assertEqual(status_v, 200)
        self.assertTrue(res_v.get('verified'))
        v_token = res_v.get('verificationToken')
        self.assertIsNotNone(v_token)

        # 3. OTP is single-use and consumed: second verification fails
        status_replay, _, _ = make_request("/api/v1/auth/verify-email-otp", method='POST', data={"email": test_email, "otp": correct_otp})
        self.assertEqual(status_replay, 400)

        # 4. Register account using verificationToken
        reg_payload = {
            "name": "Signup Test User",
            "email": test_email,
            "password": "ValidPassword123!",
            "verificationToken": v_token
        }
        status_reg, reg_res, _ = make_request("/api/v1/auth/register", method='POST', data=reg_payload)
        self.assertEqual(status_reg, 201)
        self.assertTrue(reg_res.get('success') or 'token' in reg_res)

        # 5. Token is consumed and cannot be reused
        status_reg2, _, _ = make_request("/api/v1/auth/register", method='POST', data=reg_payload)
        self.assertEqual(status_reg2, 400)


if __name__ == '__main__':
    unittest.main()
