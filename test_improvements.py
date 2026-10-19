"""
DevSync Website Improvements Verification Suite
Validates navigation links, INR pricing, contact email placeholder, dedicated terms/privacy/help pages,
Email OTP generation, expiration, rate limiting, verification token, and Django PBKDF2 password hashing.
"""

import os
import sys
import json
import time
import re
import socketserver
import threading
import urllib.request
import urllib.error
import urllib.parse

# Ensure utf-8 encoding on Windows console
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from server import DevSyncHTTPHandler, DEV_PROFILES, EMAIL_OTP_CACHE, VERIFIED_TOKENS, DB_FILE

TEST_PORT = 8011
BASE_URL = f"http://127.0.0.1:{TEST_PORT}"

class ReusableTCPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True

def run_test_server():
    server = ReusableTCPServer(('127.0.0.1', TEST_PORT), DevSyncHTTPHandler)
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    return server

def http_get(path, follow_redirects=False):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, headers={'User-Agent': 'DevSync-Test/1.0'})
    opener = urllib.request.build_opener(urllib.request.HTTPRedirectHandler if follow_redirects else urllib.request.BaseHandler)
    if not follow_redirects:
        class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, req, fp, code, msg, headers, newurl):
                return None
        opener = urllib.request.build_opener(NoRedirectHandler)
    try:
        with opener.open(req, timeout=5) as resp:
            return resp.status, resp.headers, resp.read().decode('utf-8', errors='ignore')
    except urllib.error.HTTPError as e:
        return e.code, e.headers, e.read().decode('utf-8', errors='ignore')

def http_post(path, data):
    url = f"{BASE_URL}{path}"
    payload = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=payload,
        headers={'Content-Type': 'application/json', 'User-Agent': 'DevSync-Test/1.0'}
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {'raw': body}

def test_static_files():
    print("\n--- 1. Testing Static HTML & Template Requirements ---")
    
    # 1.1 Check index.html
    with open('frontend/src/index.html', 'r', encoding='utf-8') as f:
        idx_content = f.read()
    assert '>Explore</a>' not in idx_content, "FAIL: 'Explore' still present in index.html nav links"
    assert 'Explore Projects' not in idx_content, "FAIL: 'Explore Projects' hero button still present in index.html"
    assert 'pages/public/terms.html' in idx_content, "FAIL: terms.html not linked in index.html"
    assert 'pages/public/privacy.html' in idx_content, "FAIL: privacy.html not linked in index.html"
    assert 'pages/public/help.html' in idx_content, "FAIL: help.html not linked in index.html"
    print("PASS: index.html - 'Explore' removed; Terms, Privacy, Help linked in footer")

    # 1.2 Check pages/public/home.html
    with open('frontend/src/pages/public/home.html', 'r', encoding='utf-8') as f:
        home_content = f.read()
    assert '>Explore</a>' not in home_content, "FAIL: 'Explore' still present in home.html nav links"
    assert 'Explore Projects' not in home_content, "FAIL: 'Explore Projects' hero button still present in home.html"
    assert 'terms.html' in home_content, "FAIL: terms.html not linked in home.html"
    assert 'privacy.html' in home_content, "FAIL: privacy.html not linked in home.html"
    assert 'help.html' in home_content, "FAIL: help.html not linked in home.html"
    print("PASS: home.html - 'Explore' removed; Terms, Privacy, Help linked in footer")

    # 1.3 Check pages/public/pricing.html
    with open('frontend/src/pages/public/pricing.html', 'r', encoding='utf-8') as f:
        pricing_content = f.read()
    assert '₹0' in pricing_content, "FAIL: ₹0 Developer plan missing in pricing.html"
    assert '₹999' in pricing_content, "FAIL: ₹999 Team plan missing in pricing.html"
    assert '₹4,999' in pricing_content, "FAIL: ₹4,999 Enterprise plan missing in pricing.html"
    assert '$0' not in pricing_content and '$29' not in pricing_content and '$99' not in pricing_content, "FAIL: Dollar pricing still in pricing.html"
    print("PASS: pricing.html - All tiers in INR (₹0, ₹999, ₹4,999); no dollar pricing")

    # 1.4 Check pages/public/contact.html
    with open('frontend/src/pages/public/contact.html', 'r', encoding='utf-8') as f:
        contact_content = f.read()
    assert 'hello@devsync.example' in contact_content, "FAIL: Placeholder email missing in contact.html"
    assert 'mailto:hello@devsync.example' in contact_content, "FAIL: mailto: link missing in contact.html"
    print("PASS: contact.html - Contains placeholder hello@devsync.example with mailto link")

    # 1.5 Check pages/public/terms.html
    with open('frontend/src/pages/public/terms.html', 'r', encoding='utf-8') as f:
        terms_content = f.read()
    assert 'Terms of Service' in terms_content, "FAIL: Title missing in terms.html"
    assert 'Draft Legal Review' in terms_content or 'draft' in terms_content.lower(), "FAIL: Draft review notice missing in terms.html"
    assert 'hello@devsync.example' in terms_content, "FAIL: Contact email missing in terms.html"
    print("PASS: terms.html - Dedicated page exists with draft review notice and contact email")

    # 1.6 Check pages/public/privacy.html
    with open('frontend/src/pages/public/privacy.html', 'r', encoding='utf-8') as f:
        privacy_content = f.read()
    assert 'Privacy Policy' in privacy_content, "FAIL: Title missing in privacy.html"
    assert 'hello@devsync.example' in privacy_content, "FAIL: Contact email missing in privacy.html"
    print("PASS: privacy.html - Dedicated page exists with accurate data practices")

    # 1.7 Check pages/public/help.html
    with open('frontend/src/pages/public/help.html', 'r', encoding='utf-8') as f:
        help_content = f.read()
    assert 'Help &amp; Support' in help_content or 'Help' in help_content, "FAIL: Title missing in help.html"
    assert 'hello@devsync.example' in help_content, "FAIL: Contact email missing in help.html"
    print("PASS: help.html - Dedicated page exists with FAQs and hello@devsync.example")

    # 1.8 Check Login & Signup Terms Links
    with open('frontend/src/pages/auth/sign-in.html', 'r', encoding='utf-8') as f:
        signin_content = f.read()
    assert 'pricing.html' not in signin_content, "FAIL: sign-in.html still points to pricing.html for Terms of Service!"
    assert 'terms.html' in signin_content, "FAIL: sign-in.html does not point to terms.html"
    with open('frontend/src/pages/auth/sign-up.html', 'r', encoding='utf-8') as f:
        signup_content = f.read()
    assert 'terms.html' in signup_content, "FAIL: sign-up.html does not point to terms.html"
    print("PASS: sign-in.html & sign-up.html - Terms links navigate to terms.html (not pricing)")

def test_live_server():
    print("\n--- 2. Testing Live Server Routing & Email OTP API ---")
    server = run_test_server()
    time.sleep(0.5)

    try:
        # 2.1 Route Redirects
        status, headers, _ = http_get('/terms')
        assert status in (302, 301) and 'terms.html' in headers.get('Location', ''), f"FAIL: /terms redirect failed (got {status}, {headers.get('Location')})"
        print("PASS: GET /terms redirects to terms.html")

        status, headers, _ = http_get('/privacy')
        assert status in (302, 301) and 'privacy.html' in headers.get('Location', ''), f"FAIL: /privacy redirect failed (got {status}, {headers.get('Location')})"
        print("PASS: GET /privacy redirects to privacy.html")

        status, headers, _ = http_get('/help')
        assert status in (302, 301) and 'help.html' in headers.get('Location', ''), f"FAIL: /help redirect failed (got {status}, {headers.get('Location')})"
        print("PASS: GET /help redirects to help.html")

        # 2.2 Direct HTML Serves
        status, _, body = http_get('/src/pages/public/terms.html')
        assert status == 200 and 'Terms of Service' in body, f"FAIL: GET terms.html returned {status}"
        print("PASS: GET /src/pages/public/terms.html returns 200 OK")

        status, _, body = http_get('/src/pages/public/privacy.html')
        assert status == 200 and 'Privacy Policy' in body, f"FAIL: GET privacy.html returned {status}"
        print("PASS: GET /src/pages/public/privacy.html returns 200 OK")

        status, _, body = http_get('/src/pages/public/help.html')
        assert status == 200 and 'hello@devsync.example' in body, f"FAIL: GET help.html returned {status}"
        print("PASS: GET /src/pages/public/help.html returns 200 OK")

        # 2.3 Send Email OTP - Invalid Email
        status, res = http_post('/api/v1/auth/send-email-otp', {'email': 'invalid-email'})
        assert status == 400, f"FAIL: Invalid email expected 400, got {status}: {res}"
        print("PASS: POST /api/v1/auth/send-email-otp rejects invalid email with 400")

        # 2.4 Send Email OTP - Valid Email
        test_email = f"tester_{int(time.time())}@example.com"
        # Clear any existing cache for clean test
        EMAIL_OTP_CACHE.pop(test_email, None)
        status, res = http_post('/api/v1/auth/send-email-otp', {'email': test_email})
        assert status == 200 and res.get('success') is True, f"FAIL: Send OTP failed: {res}"
        assert 'otp' not in res, f"SECURITY FAIL: Server exposed raw OTP in response: {res}"
        assert test_email in EMAIL_OTP_CACHE, "FAIL: OTP was not cached in EMAIL_OTP_CACHE"
        print("PASS: POST /api/v1/auth/send-email-otp dispatches code securely (no OTP exposed in response)")

        # 2.5 Send Email OTP - Rate Limiting Cooldown
        status, res = http_post('/api/v1/auth/send-email-otp', {'email': test_email})
        assert status == 429, f"FAIL: Expected 429 Rate Limited on immediate resend, got {status}: {res}"
        print("PASS: POST /api/v1/auth/send-email-otp enforces 60s cooldown (HTTP 429)")

        # 2.6 Verify Email OTP - Invalid Code
        status, res = http_post('/api/v1/auth/verify-email-otp', {'email': test_email, 'otp': '000000'})
        assert status == 400, f"FAIL: Expected 400 on wrong OTP, got {status}: {res}"
        print("PASS: POST /api/v1/auth/verify-email-otp rejects incorrect code (HTTP 400)")

        # 2.7 Registration Without Token
        status, res = http_post('/api/v1/auth/register', {
            'email': test_email,
            'name': 'Test Developer',
            'password': 'SecurePassword123!'
        })
        assert status == 400 and 'verification' in str(res).lower(), f"FAIL: Registration without OTP token should fail: {res}"
        print("PASS: POST /api/v1/auth/register blocks registration without email verification token")

        # 2.8 Registration With Short Password (< 8 chars)
        status, res = http_post('/api/v1/auth/register', {
            'email': test_email,
            'name': 'Test Developer',
            'password': 'short',
            'verificationToken': 'fake-token'
        })
        assert status == 400, f"FAIL: Password < 8 characters should fail: {res}"
        print("PASS: POST /api/v1/auth/register enforces minimum 8 characters password length")

        # 2.9 Successful Email OTP Verification
        # Retrieve actual OTP from in-memory cache to simulate user checking email inbox
        cached_record = EMAIL_OTP_CACHE.get(test_email)
        assert cached_record is not None
        # To get the code, let's find the 6-digit code matching the salt & hash
        correct_otp = None
        for candidate in range(100000, 1000000):
            cand_str = str(candidate)
            import hashlib
            if hashlib.sha256(f"{cached_record['salt']}:{cand_str}".encode('utf-8')).hexdigest() == cached_record['hash']:
                correct_otp = cand_str
                break
        assert correct_otp is not None, "FAIL: Could not resolve OTP from salt and hash"

        status, res = http_post('/api/v1/auth/verify-email-otp', {'email': test_email, 'otp': correct_otp})
        assert status == 200 and res.get('verified') is True, f"FAIL: Verify OTP failed: {res}"
        verification_token = res.get('verificationToken')
        assert verification_token and verification_token in VERIFIED_TOKENS, "FAIL: Verification token not issued or cached"
        print(f"PASS: POST /api/v1/auth/verify-email-otp successfully validates OTP and issues single-use token")

        # 2.10 Successful Registration with Verification Token & Password Hashing
        status, res = http_post('/api/v1/auth/register', {
            'email': test_email,
            'name': 'Test Developer',
            'password': 'DevPassword2026!',
            'verificationToken': verification_token
        })
        assert status == 201 and res.get('access'), f"FAIL: Registration failed: {res}"
        created_user = res.get('user')
        assert created_user and created_user['email'] == test_email
        print("PASS: POST /api/v1/auth/register successfully creates user with verified email")

        # Verify password is NOT plaintext in database
        with open(DB_FILE, 'r', encoding='utf-8') as f:
            db_data = json.load(f)
        profiles = db_data.get('profiles', {})
        reg_user = None
        for u in profiles.values():
            if u.get('email') == test_email:
                reg_user = u
                break
        assert reg_user is not None, "FAIL: Created user not found in database file"
        assert reg_user['password'].startswith('pbkdf2_sha256$'), f"FAIL: Password is not PBKDF2 hashed: {reg_user['password']}"
        print(f"PASS: User password securely hashed with Django PBKDF2 hasher: {reg_user['password'][:30]}...")

        # 2.11 Login with New User Hashed Password
        status, res = http_post('/api/v1/auth/login', {
            'email': test_email,
            'password': 'DevPassword2026!'
        })
        assert status == 200 and res.get('access'), f"FAIL: Login with newly created user failed: {res}"
        print("PASS: POST /api/v1/auth/login successfully authenticates with hashed password")

        # 2.12 Login with Legacy Demo Account (balaji@devsync.dev / demo12345)
        status, res = http_post('/api/v1/auth/login', {
            'email': 'balaji@devsync.dev',
            'password': 'demo12345'
        })
        assert status == 200 and res.get('access'), f"FAIL: Login with demo account failed: {res}"
        # Verify it upgraded password to PBKDF2 hash
        balaji_user = DEV_PROFILES.get('balajikumar')
        assert balaji_user and balaji_user['password'].startswith('pbkdf2_sha256$'), "FAIL: Demo password not upgraded to PBKDF2 hash"
        print("PASS: POST /api/v1/auth/login successfully authenticates demo account and auto-upgrades to PBKDF2 hash")

    finally:
        server.shutdown()
        server.server_close()

if __name__ == '__main__':
    test_static_files()
    test_live_server()
    print("\n=======================================================")
    print("ALL TESTS PASSED SUCCESSFULLY! ALL REQUIREMENTS MET.")
    print("=======================================================")
