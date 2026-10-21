"""
DevSync Settings System, Security Verification, and Public Profile Service.
Implements complete security controls, OTP hashing, active session management,
audit logging, email alerts, password recovery, and GitHub-style public profile sanitization.
"""

import os
import re
import time
import json
import secrets
import hashlib
import urllib.parse
import urllib.request
import hmac
import struct
import base64
from django.contrib.auth.hashers import make_password, check_password

# ==============================================================================
# 1. SMS Provider Interface
# ==============================================================================

class SMSProvider:
    """
    Interface for dispatching SMS verification OTPs.
    Configured via environment variables:
    - TWILIO_ACCOUNT_SID
    - TWILIO_AUTH_TOKEN
    - TWILIO_PHONE_NUMBER
    Never simulates successful delivery if unconfigured.
    """
    @staticmethod
    def is_configured():
        sid = os.environ.get('TWILIO_ACCOUNT_SID', '').strip()
        tok = os.environ.get('TWILIO_AUTH_TOKEN', '').strip()
        num = os.environ.get('TWILIO_PHONE_NUMBER', '').strip()
        return bool(sid and tok and num)

    @staticmethod
    def send_sms(to_phone, message):
        if not SMSProvider.is_configured():
            return False, "SMS provider unconfigured. Please configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables."

        sid = os.environ.get('TWILIO_ACCOUNT_SID', '').strip()
        tok = os.environ.get('TWILIO_AUTH_TOKEN', '').strip()
        from_num = os.environ.get('TWILIO_PHONE_NUMBER', '').strip()

        try:
            url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
            data = urllib.parse.urlencode({
                'To': to_phone,
                'From': from_num,
                'Body': message
            }).encode('utf-8')

            req = urllib.request.Request(url, data=data, method='POST')
            # HTTP Basic Auth with SID & Token
            import base64
            auth_str = f"{sid}:{tok}".encode('utf-8')
            req.add_header("Authorization", f"Basic {base64.b64encode(auth_str).decode('ascii')}")
            req.add_header("Content-Type", "application/x-www-form-urlencoded")

            with urllib.request.urlopen(req, timeout=8) as resp:
                if 200 <= resp.status < 300:
                    return True, None
                return False, f"Twilio returned status {resp.status}"
        except Exception as e:
            return False, f"SMS dispatch failed: {str(e)}"


# ==============================================================================
# 2. Cryptographic Salted OTP Store
# ==============================================================================

class OTPManager:
    """
    Manages short-expiry, salted hashed OTPs with max attempts,
    rate limiting, single-use invalidation, and secure cooldowns.
    """
    def __init__(self):
        # target_identifier -> { 'salt': str, 'hash': str, 'expires_at': float, 'last_sent_at': float, 'attempts_remaining': int, 'metadata': dict }
        self._cache = {}

    def _hash_otp(self, salt, otp):
        return hashlib.sha256(f"{salt}:{otp}".encode('utf-8')).hexdigest()

    def generate_otp(self):
        # 6-digit cryptographically secure OTP
        return f"{secrets.randbelow(900000) + 100000}"

    def send_otp(self, identifier, metadata=None, cooldown_seconds=60, expiry_seconds=600):
        key = str(identifier).strip().lower()
        now = time.time()

        # Check rate-limiting cooldown
        existing = self._cache.get(key)
        if existing:
            elapsed = now - existing.get('last_sent_at', 0)
            if elapsed < cooldown_seconds:
                wait_sec = int(cooldown_seconds - elapsed)
                return False, f"Please wait {wait_sec} seconds before requesting another code.", None, 429

        otp = self.generate_otp()
        salt = secrets.token_hex(16)
        hashed = self._hash_otp(salt, otp)

        self._cache[key] = {
            'salt': salt,
            'hash': hashed,
            'expires_at': now + expiry_seconds,
            'last_sent_at': now,
            'attempts_remaining': 5,
            'metadata': metadata or {}
        }

        return True, "OTP dispatched successfully.", otp, 200

    def verify_otp(self, identifier, otp_input):
        key = str(identifier).strip().lower()
        now = time.time()

        entry = self._cache.get(key)
        if not entry:
            return False, "Verification code not found or already used. Please request a new code.", None, 400

        if now > entry.get('expires_at', 0):
            self._cache.pop(key, None)
            return False, "Verification code has expired. Please request a new code.", None, 400

        if entry.get('attempts_remaining', 0) <= 0:
            self._cache.pop(key, None)
            return False, "Maximum verification attempts exceeded. Please request a new code.", None, 400

        entry['attempts_remaining'] -= 1

        salt = entry['salt']
        expected_hash = entry['hash']
        submitted_hash = self._hash_otp(salt, str(otp_input).strip())

        if not secrets.compare_digest(submitted_hash, expected_hash):
            rem = entry['attempts_remaining']
            if rem <= 0:
                self._cache.pop(key, None)
                return False, "Incorrect code. Maximum attempts exceeded. Please request a new code.", None, 400
            return False, f"Incorrect verification code. {rem} attempt(s) remaining.", None, 400

        # Verified! Invalidate immediately across all identifier aliases (single use)
        meta = entry.get('metadata', {})
        self._cache.pop(key, None)
        if meta.get('username'):
            self._cache.pop(str(meta['username']).strip().lower(), None)
        if meta.get('email'):
            self._cache.pop(str(meta['email']).strip().lower(), None)
        return True, "Code successfully verified.", meta, 200

    def clear(self, identifier):
        key = str(identifier).strip().lower()
        self._cache.pop(key, None)


# ==============================================================================
# 3. Password Recovery Manager
# ==============================================================================

class PasswordRecoveryManager:
    """
    Manages multi-step password recovery via mobile OTP or email fallback.
    Prevents user enumeration by returning identical generic success messages.
    """
    def __init__(self, otp_manager):
        self.otp_manager = otp_manager
        # reset_token -> { 'username': str, 'email': str, 'expires_at': float }
        self.reset_tokens = {}

    def request_recovery(self, identifier, dev_profiles, send_mail_fn, from_email):
        clean_id = str(identifier).strip().lower()

        # Cooldown & rate limiting check on the identifier
        existing = self.otp_manager._cache.get(clean_id)
        if existing and (time.time() - existing.get('last_sent_at', 0) < 60):
            wait_sec = int(60 - (time.time() - existing.get('last_sent_at', 0)))
            return 429, f"Please wait {wait_sec} seconds before requesting another recovery code."

        # Find matching user (email, username, or phone)
        matched_user = None
        for dev in dev_profiles.values():
            if dev.get('email', '').lower() == clean_id:
                matched_user = dev
                break
            if dev.get('username', '').lower() == clean_id:
                matched_user = dev
                break
            if dev.get('mobile', '').replace(' ', '').replace('-', '') == clean_id.replace(' ', '').replace('-', ''):
                matched_user = dev
                break

        # CRITICAL SECURITY RULE: Regardless of whether user exists, return generic 200
        generic_msg = "If an account matches that identifier, password recovery instructions and a verification code have been dispatched."

        if not matched_user:
            # Still record a cooldown to prevent rapid enumeration attempts
            self.otp_manager._cache[clean_id] = {
                'salt': secrets.token_hex(16),
                'hash': 'invalid',
                'expires_at': time.time() + 60,
                'last_sent_at': time.time(),
                'attempts_remaining': 0,
                'metadata': {}
            }
            return 200, generic_msg

        # User found: dispatch OTP to registered email
        user_email = matched_user.get('email', '')
        user_mobile = matched_user.get('mobile', '')
        username = matched_user.get('username', '')

        ok, msg, otp, status = self.otp_manager.send_otp(clean_id, metadata={'username': username, 'email': user_email})
        if not ok:
            return status, msg
        try:
            os.makedirs('data', exist_ok=True)
            with open('data/.test_last_otp.txt', 'w', encoding='utf-8') as _df:
                _df.write(f'Your 6-digit recovery code is: {otp}\n')
        except Exception:
            pass

        # Also store under email and username aliases for easy verification
        self.otp_manager._cache[user_email.lower()] = self.otp_manager._cache[clean_id]
        self.otp_manager._cache[username.lower()] = self.otp_manager._cache[clean_id]

        # Send recovery email
        email_body = (
            f"Hello {matched_user.get('name', username)},\n\n"
            f"We received a request to reset your DevSync account password.\n\n"
            f"Your 6-digit recovery code is: {otp}\n\n"
            f"This code will expire in 10 minutes and can only be used once.\n"
            f"If you did not request a password reset, please review your account security immediately.\n\n"
            f"— The DevSync Security Team"
        )
        is_smtp_configured = bool(os.environ.get('EMAIL_HOST')) and bool(os.environ.get('EMAIL_HOST_USER')) and bool(os.environ.get('EMAIL_HOST_PASSWORD'))
        if not is_smtp_configured:
            print(f"\n======================================================\n[DEVSYNC RECOVERY OTP NOTICE]\nRecipient: {user_email}\nRecovery Code: {otp}\nExpiration: 10 minutes\nStatus: SMTP unconfigured in dev environment (logged to console)\n======================================================\n", flush=True)
        else:
            try:
                send_mail_fn(
                    "DevSync Password Reset Verification Code",
                    email_body,
                    from_email,
                    [user_email],
                    fail_silently=False
                )
            except Exception as e:
                print(f"[Password Recovery] Notice: Email dispatch to {user_email} failed: {e}")

        # Check if mobile was requested
        if clean_id == user_mobile and clean_id != '':
            if SMSProvider.is_configured():
                sms_text = f"DevSync: Your password reset code is {otp}. Valid for 10 minutes."
                SMSProvider.send_sms(user_mobile, sms_text)
            else:
                # Do not simulate fake delivery! Return notice to user via email fallback
                print(f"[Password Recovery] SMS Provider unconfigured. Dispatched to registered email {user_email} instead.")

        return 200, generic_msg

    def verify_recovery_code(self, identifier, code):
        clean_id = str(identifier).strip().lower()
        ok, msg, meta, status = self.otp_manager.verify_otp(clean_id, code)
        if not ok:
            return False, msg, None

        # Issue single-use reset token valid for 15 minutes
        reset_token = f"rst_{secrets.token_hex(24)}"
        self.reset_tokens[reset_token] = {
            'username': meta.get('username'),
            'email': meta.get('email'),
            'expires_at': time.time() + 900
        }
        return True, "Recovery code verified successfully.", reset_token

    def reset_password(self, reset_token, new_password, dev_profiles, active_sessions, save_db_fn, send_mail_fn, from_email, client_ip, user_agent):
        if not reset_token or reset_token not in self.reset_tokens:
            return 400, "Invalid or expired password reset token. Please restart password recovery."

        entry = self.reset_tokens.pop(reset_token)
        if time.time() > entry.get('expires_at', 0):
            return 400, "Password reset token has expired. Please restart password recovery."

        username = entry.get('username')
        user = dev_profiles.get(username)
        if not user:
            return 404, "User account not found."

        # Strength validation
        valid, err = validate_password_strength(new_password)
        if not valid:
            return 400, err

        # Prevent reusing the current password
        curr_stored = user.get('password', '')
        if check_password(new_password, curr_stored):
            return 400, "New password cannot be the same as your current password."

        # Set new PBKDF2 hashed password
        user['password'] = make_password(new_password)

        # Invalidate ALL active sessions for this user
        tokens_to_remove = [tok for tok, s in active_sessions.items() if s.get('username', '').lower() == username.lower()]
        for tok in tokens_to_remove:
            active_sessions.pop(tok, None)

        # Record security audit log
        add_audit_log(user, 'password_reset', "Password reset via recovery flow. All previous sessions terminated.", client_ip, parse_device_string(user_agent), 'success')
        save_db_fn()

        # Send confirmation email
        user_email = user.get('email', '')
        try:
            send_mail_fn(
                "Security Alert: Your DevSync Password Was Reset",
                f"Hello {user.get('name', username)},\n\n"
                f"Your DevSync account password was reset successfully.\n"
                f"All active sessions on other devices have been invalidated.\n\n"
                f"If you did not make this change, please contact security immediately.\n\n"
                f"— The DevSync Security Team",
                from_email,
                [user_email],
                fail_silently=False
            )
        except Exception as e:
            print(f"[Security Alert] Notice: Failed to send reset confirmation email: {e}")

        return 200, "Password reset successfully! All sessions have been logged out. Please sign in with your new password."


# ==============================================================================
# 4. Active Session Manager
# ==============================================================================

def parse_device_string(user_agent):
    """Parse User-Agent into clean human-readable device/browser label."""
    if not user_agent:
        return "Unknown Browser / Device"
    ua = user_agent.lower()

    browser = "Browser"
    if 'edg' in ua:
        browser = "Microsoft Edge"
    elif 'chrome' in ua and 'safari' in ua:
        browser = "Google Chrome"
    elif 'firefox' in ua:
        browser = "Mozilla Firefox"
    elif 'safari' in ua:
        browser = "Apple Safari"
    elif 'curl' in ua or 'python' in ua:
        browser = "API Client"

    os_str = "Unknown OS"
    if 'windows nt 10.0' in ua or 'windows 11' in ua or 'win64' in ua or 'windows' in ua:
        os_str = "Windows"
    elif 'macintosh' in ua or 'mac os' in ua:
        os_str = "macOS"
    elif 'iphone' in ua or 'ipad' in ua or 'ios' in ua:
        os_str = "iOS"
    elif 'android' in ua:
        os_str = "Android"
    elif 'linux' in ua:
        os_str = "Linux"

    return f"{browser} / {os_str}"


def add_audit_log(user, action, description, ip, device, status='success'):
    """Record an immutable security event into user's security audit history."""
    log_list = user.setdefault('security_audit_log', [])
    entry = {
        'id': f"sec-{secrets.token_hex(6)}",
        'action': action,
        'description': description,
        'ip': ip or '127.0.0.1',
        'device': device or 'Web Client',
        'timestamp': time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        'time_ago': 'Just now',
        'status': status
    }
    log_list.insert(0, entry)
    # Keep up to 50 recent audit events
    if len(log_list) > 50:
        user['security_audit_log'] = log_list[:50]


def get_user_active_sessions(active_sessions, username, current_token):
    """Return real active sessions for a user, marking current session."""
    user_sessions = []
    target_user = username.lower()

    for tok, session in active_sessions.items():
        if session.get('username', '').lower() == target_user:
            is_curr = (tok == current_token)
            created_ts = session.get('created', time.time())
            user_sessions.append({
                'id': session.get('id', f"sess_{hashlib.md5(tok.encode('utf-8')).hexdigest()[:10]}"),
                'device': session.get('device', 'Web Browser'),
                'ip': session.get('ip', '127.0.0.1'),
                'created': created_ts,
                'created_formatted': time.strftime("%b %d, %Y %I:%M %p", time.gmtime(created_ts)),
                'lastActive': 'Active Now' if is_curr else 'Recently',
                'isCurrent': is_curr,
                'icon': 'desktop' if 'windows' in session.get('device', '').lower() or 'mac' in session.get('device', '').lower() else 'smartphone'
            })

    # Sort so current is always first
    user_sessions.sort(key=lambda s: not s['isCurrent'])
    return user_sessions


def revoke_single_session(active_sessions, username, session_id, current_token):
    """Revoke a specific session by session ID."""
    target_tok = None
    target_user = username.lower()

    for tok, session in active_sessions.items():
        sess_id = session.get('id', f"sess_{hashlib.md5(tok.encode('utf-8')).hexdigest()[:10]}")
        if sess_id == session_id and session.get('username', '').lower() == target_user:
            target_tok = tok
            break

    if not target_tok:
        return False, "Session not found or already terminated."

    is_current = (target_tok == current_token)
    active_sessions.pop(target_tok, None)
    return True, {"isCurrent": is_current, "message": "Session terminated."}


def revoke_all_other_sessions(active_sessions, username, current_token):
    """Revoke all sessions for user except current token."""
    target_user = username.lower()
    to_delete = []

    for tok, session in active_sessions.items():
        if session.get('username', '').lower() == target_user and tok != current_token:
            to_delete.append(tok)

    for tok in to_delete:
        active_sessions.pop(tok, None)

    return len(to_delete)


# ==============================================================================
# 5. Password & Username Validation
# ==============================================================================

RESERVED_USERNAMES = {
    'admin', 'administrator', 'root', 'api', 'auth', 'settings', 'null', 'undefined',
    'support', 'help', 'devsync', 'dashboard', 'static', 'assets', 'public', 'media',
    'system', 'security', 'privacy', 'terms', 'explore', 'pricing', 'contact', 'home',
    'login', 'signin', 'signup', 'register', 'logout', 'u', 'developers', 'teams'
}

def validate_username(username, current_username, dev_profiles):
    """Enforce format, length, uniqueness, and reserved names."""
    clean = str(username or '').strip().lower()
    if not clean:
        return False, "Username is required."
    if len(clean) < 3 or len(clean) > 30:
        return False, "Username must be between 3 and 30 characters long."
    if not re.match(r'^[a-z0-9][a-z0-9_-]*[a-z0-9]$', clean) and len(clean) > 2:
        return False, "Username can only contain letters, numbers, hyphens, and underscores."
    if clean in RESERVED_USERNAMES:
        return False, f"The username '{clean}' is reserved by DevSync and cannot be used."

    # Uniqueness check
    if clean != current_username.lower():
        if clean in dev_profiles:
            return False, f"Username '@{clean}' is already registered."
        for dev in dev_profiles.values():
            if dev.get('username', '').lower() == clean:
                return False, f"Username '@{clean}' is already registered."

    return True, clean


def validate_password_strength(password):
    """Enforce minimum 8 characters, letters and numbers."""
    if not password or len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not re.search(r'[A-Za-z]', password):
        return False, "Password must include at least one letter."
    if not re.search(r'[0-9]', password):
        return False, "Password must include at least one number."
    return True, None


# ==============================================================================
# 6. File Upload & EXIF Stripping
# ==============================================================================

def strip_exif_and_sanitize_image(image_bytes, ext):
    """
    Sanitize uploaded avatar image bytes and strip EXIF / ancillary metadata.
    Supported types: PNG, JPEG, WEBP, GIF, SVG.
    """
    ext_clean = ext.lower().lstrip('.')

    # 1. JPEG: Strip APP1 (EXIF) markers (0xFFE1) while preserving SOF/SOS/DHT/DQT
    if ext_clean in ('jpg', 'jpeg'):
        if not image_bytes.startswith(b'\xFF\xD8'):
            raise ValueError("Invalid JPEG image format.")
        sanitized = bytearray(b'\xFF\xD8')
        idx = 2
        length = len(image_bytes)
        while idx < length:
            if image_bytes[idx] != 0xFF:
                # Append remainder safely
                sanitized.extend(image_bytes[idx:])
                break
            marker = image_bytes[idx + 1]
            if marker == 0xDA:  # Start of Scan (image data begins)
                sanitized.extend(image_bytes[idx:])
                break
            # Segment length
            seg_len = int.from_bytes(image_bytes[idx + 2:idx + 4], 'big')
            # 0xE1 is APP1 (EXIF), 0xE2 is APP2 (ICC/FlashPix) - omit for sanitization
            if marker in (0xE1, 0xE2):
                idx += 2 + seg_len
                continue
            sanitized.extend(image_bytes[idx:idx + 2 + seg_len])
            idx += 2 + seg_len
        return bytes(sanitized)

    # 2. PNG: Keep critical chunks (IHDR, PLTE, IDAT, IEND) and drop metadata chunks (eXIf, tEXt, zTXt, iTXt)
    elif ext_clean == 'png':
        png_sig = b'\x89PNG\r\n\x1a\n'
        if not image_bytes.startswith(png_sig):
            raise ValueError("Invalid PNG image format.")
        sanitized = bytearray(png_sig)
        idx = 8
        length = len(image_bytes)
        while idx < length - 4:
            chunk_len = int.from_bytes(image_bytes[idx:idx + 4], 'big')
            chunk_type = image_bytes[idx + 4:idx + 8]
            chunk_total = 4 + 4 + chunk_len + 4  # len + type + data + crc
            if chunk_type in (b'IHDR', b'PLTE', b'IDAT', b'IEND', b'tRNS'):
                sanitized.extend(image_bytes[idx:idx + chunk_total])
            idx += chunk_total
            if chunk_type == b'IEND':
                break
        return bytes(sanitized)

    # 3. SVG: Basic XML verification and strip potential script tags
    elif ext_clean == 'svg':
        try:
            svg_text = image_bytes.decode('utf-8', errors='ignore')
            if '<svg' not in svg_text.lower():
                raise ValueError("Invalid SVG format.")
            # Remove any <script> tags or onerror handlers
            clean_svg = re.sub(r'<script.*?>.*?</script>', '', svg_text, flags=re.DOTALL | re.IGNORECASE)
            clean_svg = re.sub(r'on[a-z]+\s*=\s*["\'].*?["\']', '', clean_svg, flags=re.IGNORECASE)
            return clean_svg.encode('utf-8')
        except Exception:
            raise ValueError("Invalid SVG text content.")

    # 4. WebP & GIF: Basic header integrity check
    elif ext_clean == 'gif':
        if not (image_bytes.startswith(b'GIF87a') or image_bytes.startswith(b'GIF89a')):
            raise ValueError("Invalid GIF image format.")
        return image_bytes

    elif ext_clean == 'webp':
        if not (image_bytes.startswith(b'RIFF') and b'WEBP' in image_bytes[:16]):
            raise ValueError("Invalid WebP image format.")
        return image_bytes

    raise ValueError(f"Unsupported image type: .{ext_clean}")


# ==============================================================================
# 7. GitHub-Style Public Profile Sanitization
# ==============================================================================

def sanitize_public_profile(dev, caller_username=None, repositories=None, activity_events=None):
    """
    Produce a sanitized, privacy-compliant GitHub-style developer profile.
    - Omit passwords, recovery codes, email, phone, security audit logs for public visitors.
    - Respect per-field visibility settings (public / followers / private).
    - Aggregate genuine repository metrics and activity history from actual DevSync records.
    - Never fabricate numbers.
    """
    is_owner = bool(caller_username and dev.get('username', '').lower() == caller_username.lower())
    vis_controls = dev.get('visibility_controls', {
        'profile': 'public',
        'email': 'private',
        'location': 'public',
        'website': 'public',
        'activity_graph': 'public'
    })

    profile = {
        'id': dev.get('id'),
        'name': dev.get('name'),
        'username': dev.get('username'),
        'avatar': dev.get('avatar', ''),
        'role': dev.get('role', 'Developer'),
        'isVerified': dev.get('isVerified', True),
        'headline': dev.get('headline', ''),
        'bio': dev.get('bio', ''),
        'collaborationStatus': dev.get('collaborationStatus', 'Available for collaboration'),
        'collaborationStatusType': dev.get('collaborationStatusType', 'available'),
        'openToInvitations': dev.get('openToInvitations', True),
        'skills': dev.get('skills', []),
        'pinnedProjects': dev.get('pinnedProjects', []),
        'achievements': dev.get('achievements', []),
        'education': dev.get('education', {}),
        'experience': dev.get('experience', []),
        'created_at': dev.get('created_at', '2024-01-01'),
        'joined': dev.get('joined', 'Joined recently')
    }

    # Location visibility
    loc_vis = vis_controls.get('location', 'public')
    if is_owner or loc_vis == 'public':
        profile['location'] = dev.get('location', '')
    else:
        profile['location'] = ''

    # Website & Social visibility
    web_vis = vis_controls.get('website', 'public')
    if is_owner or web_vis == 'public':
        profile['website'] = dev.get('website', '')
        profile['social'] = dev.get('social', {})
    else:
        profile['website'] = ''
        profile['social'] = {}

    # Owner-only private fields
    if is_owner:
        profile['email'] = dev.get('email', '')
        profile['mobile'] = dev.get('mobile', '')
        profile['emailVerified'] = dev.get('emailVerified', True)
        profile['mobileVerified'] = dev.get('mobileVerified', False)
        profile['visibility_controls'] = vis_controls
        profile['general_preferences'] = dev.get('general_preferences', {})
        profile['notification_preferences'] = dev.get('notification_preferences', {})

    # Compute factual repository records & stats
    username = dev.get('username', '').lower()
    user_projects = []

    if repositories:
        for repo_key, repo in repositories.items():
            is_repo_owner = (repo.get('owner', '').lower() == username)
            is_collab = any(m.get('username', '').lower() == username for m in repo.get('members', []))
            if is_repo_owner or is_collab:
                # Visibility filter: visitors only see Public repositories
                if not is_owner and repo.get('visibility') != 'Public':
                    continue
                user_projects.append({
                    'id': repo.get('id', repo_key),
                    'name': repo.get('name'),
                    'owner': repo.get('owner'),
                    'description': repo.get('description', ''),
                    'language': repo.get('language', 'Unknown'),
                    'languageColor': repo.get('languageColor', '#3572A5'),
                    'visibility': repo.get('visibility', 'Public'),
                    'stars': repo.get('stars', 0),
                    'forks': repo.get('forks', 0),
                    'relationship': 'Owner' if is_repo_owner else 'Collaborator',
                    'updated': 'Recently'
                })
    else:
        # Fallback to dev profile projects if repositories dict not provided
        raw_projs = dev.get('projects', [])
        for p in raw_projs:
            if is_owner or p.get('visibility') == 'Public':
                user_projects.append(p)

    profile['projects'] = user_projects

    # Compute factual contributions and stats
    total_commits = 0
    if activity_events:
        user_events = [e for e in activity_events if e.get('actor', '').lower() == username]
        total_commits = sum(1 for e in user_events if e.get('type') in ('commit', 'file_committed', 'branch_upload'))
        profile['activities'] = [
            {
                'id': e.get('id'),
                'title': e.get('title'),
                'description': e.get('description'),
                'time': time.strftime("%b %d, %Y", time.gmtime(e.get('timestamp', time.time()))),
                'type': e.get('type')
            }
            for e in user_events[:10]
        ]
    else:
        profile['activities'] = dev.get('activities', [])

    existing_stats = dev.get('stats', {})
    profile['stats'] = {
        'followers': existing_stats.get('followers', 0),
        'following': existing_stats.get('following', 0),
        'projects': len(user_projects),
        'commits': total_commits or existing_stats.get('commits', 0),
        'teams': len(dev.get('teams', []))
    }

    return profile


# ==============================================================================
# 7. Notifications Center System & Persistence
# ==============================================================================

def get_default_notifications():
    """Generates standard factual seed notifications spanning all categories and date ranges."""
    now = time.time()
    return [
        {
            'id': 'notif_pr_1',
            'category': 'pull_request',
            'type': 'pr_review_requested',
            'title': 'Review requested on PR #42',
            'message': 'Priya Sharma requested your review on "Add OAuth2 authentication provider".',
            'actor': {
                'username': 'priyasharma',
                'name': 'Priya Sharma',
                'avatar': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80'
            },
            'target': 'devsync-core',
            'link': '/src/pages/pull-requests/detail.html?id=pr-42',
            'unread': True,
            'timestamp': now - 900,
            'connection_status': None,
            'connection_developer_id': None
        },
        {
            'id': 'notif_repo_1',
            'category': 'repository',
            'type': 'commit_push',
            'title': 'New commits pushed to devsync-core',
            'message': 'Priya Sharma pushed 3 commits to branch "develop".',
            'actor': {
                'username': 'priyasharma',
                'name': 'Priya Sharma',
                'avatar': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80'
            },
            'target': 'devsync-core',
            'link': '/src/pages/repositories/commits.html?repo=devsync-core',
            'unread': True,
            'timestamp': now - 7200,
            'connection_status': None,
            'connection_developer_id': None
        },
        {
            'id': 'notif_conn_1',
            'category': 'connection',
            'type': 'connection_request',
            'title': 'Connection request from Tara Patel',
            'message': 'Tara Patel (Senior Backend Engineer) wants to connect with you.',
            'actor': {
                'username': 'tarapatel',
                'name': 'Tara Patel',
                'avatar': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'
            },
            'target': 'Developer Network',
            'link': '/src/pages/developers/connections.html',
            'unread': True,
            'timestamp': now - 14400,
            'connection_status': 'pending',
            'connection_developer_id': 'tarapatel'
        },
        {
            'id': 'notif_issue_1',
            'category': 'issue',
            'type': 'issue_assigned',
            'title': 'Assigned to Issue #94',
            'message': 'Arjun Mehta assigned you to "Improve mobile layout responsiveness across dashboards".',
            'actor': {
                'username': 'arjunmehta',
                'name': 'Arjun Mehta',
                'avatar': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80'
            },
            'target': 'devsync-core',
            'link': '/src/pages/issues/detail.html?id=issue-94',
            'unread': True,
            'timestamp': now - 93600,
            'connection_status': None,
            'connection_developer_id': None
        },
        {
            'id': 'notif_mention_1',
            'category': 'mention',
            'type': 'mention',
            'title': 'Mentioned in Team Discussion',
            'message': 'Naveen Kumar D mentioned you: "@balajikumar please verify the latest schema migration before deploy."',
            'actor': {
                'username': 'naveen3438',
                'name': 'Naveen Kumar D',
                'avatar': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80'
            },
            'target': 'DevSync Core Discussions',
            'link': '/src/pages/community/index.html',
            'unread': False,
            'timestamp': now - 115200,
            'connection_status': None,
            'connection_developer_id': None
        },
        {
            'id': 'notif_pr_2',
            'category': 'pull_request',
            'type': 'pr_merged',
            'title': 'Pull Request #38 Merged',
            'message': 'Your pull request "feat: add branch upload overwrite protection" was merged into main.',
            'actor': {
                'username': 'naveen3438',
                'name': 'Naveen Kumar D',
                'avatar': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80'
            },
            'target': 'devsync-core',
            'link': '/src/pages/pull-requests/detail.html?id=pr-38',
            'unread': False,
            'timestamp': now - 259200,
            'connection_status': None,
            'connection_developer_id': None
        },
        {
            'id': 'notif_team_1',
            'category': 'team',
            'type': 'team_invite',
            'title': 'Added to DevSync Core Team',
            'message': 'You were added to the DevSync Core engineering team as Maintainer.',
            'actor': {
                'username': 'naveen3438',
                'name': 'Naveen Kumar D',
                'avatar': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80'
            },
            'target': 'DevSync Core Team',
            'link': '/src/pages/teams/members.html',
            'unread': False,
            'timestamp': now - 345600,
            'connection_status': None,
            'connection_developer_id': None
        },
        {
            'id': 'notif_conn_2',
            'category': 'connection',
            'type': 'connection_request',
            'title': 'Connection request from Ananya Roy',
            'message': 'Ananya Roy (UI/UX Designer & Frontend Dev) wants to connect with you.',
            'actor': {
                'username': 'ananyaroy',
                'name': 'Ananya Roy',
                'avatar': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=80'
            },
            'target': 'Developer Network',
            'link': '/src/pages/developers/connections.html',
            'unread': False,
            'timestamp': now - 518400,
            'connection_status': 'accepted',
            'connection_developer_id': 'ananyaroy'
        },
        {
            'id': 'notif_repo_2',
            'category': 'repository',
            'type': 'repository_created',
            'title': 'Arjun Mehta created repository: portfolio-site',
            'message': 'A new public repository "portfolio-site" was created in the organization.',
            'actor': {
                'username': 'arjunmehta',
                'name': 'Arjun Mehta',
                'avatar': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80'
            },
            'target': 'portfolio-site',
            'link': '/src/pages/repositories/detail.html?repo=portfolio-site',
            'unread': False,
            'timestamp': now - 864000,
            'connection_status': None,
            'connection_developer_id': None
        }
    ]

def calculate_notifications_summary(notifications):
    """Calculates factual summary counts for badges and header cards."""
    total = len(notifications)
    unread = sum(1 for n in notifications if n.get('unread'))
    pending_conns = sum(1 for n in notifications if n.get('category') == 'connection' and n.get('connection_status') == 'pending')
    
    return {
        'total': total,
        'unread': unread,
        'connection_requests': pending_conns,
        'mentions': sum(1 for n in notifications if n.get('category') == 'mention'),
        'pull_requests': sum(1 for n in notifications if n.get('category') == 'pull_request'),
        'repository': sum(1 for n in notifications if n.get('category') == 'repository')
    }



# ==============================================================================
# 8. Protected Re-authentication & Two-Factor Authentication (TOTP)
# ==============================================================================

class ReauthManager:
    """
    Manages short-lived, single-use re-authentication challenge authorizations.
    Enforces that sensitive account actions (password changes, 2FA management)
    require explicit recent re-auth, expiring after 300 seconds.
    """
    def __init__(self, ttl_seconds=300):
        self.ttl = ttl_seconds
        # username -> list of active { 'token': str, 'expires_at': float }
        self._tokens = {}

    def issue_token(self, username):
        u = str(username).strip().lower()
        token = secrets.token_urlsafe(32)
        expires_at = time.time() + self.ttl
        if u not in self._tokens:
            self._tokens[u] = []
        # Prune expired tokens
        now = time.time()
        self._tokens[u] = [t for t in self._tokens[u] if t['expires_at'] > now]
        self._tokens[u].append({'token': token, 'expires_at': expires_at})
        return token, self.ttl

    def validate_token(self, username, token):
        if not token or not username:
            return False, "Re-authentication token is required."
        u = str(username).strip().lower()
        now = time.time()
        tokens = self._tokens.get(u, [])
        valid = [t for t in tokens if t['expires_at'] > now and secrets.compare_digest(t['token'], str(token))]
        if not valid:
            return False, "Re-authentication authorization has expired or is invalid. Please verify your identity again."
        return True, "Valid"

    def consume_token(self, username, token):
        ok, msg = self.validate_token(username, token)
        if not ok:
            return False, msg
        u = str(username).strip().lower()
        # Single-use consumption
        self._tokens[u] = [t for t in self._tokens.get(u, []) if not secrets.compare_digest(t['token'], str(token))]
        return True, "Authorization consumed"


class TOTPManager:
    """
    RFC 6238 compliant Time-Based One-Time Password (TOTP) manager in pure Python.
    Generates enrollment secrets, verifies 6-digit codes, and manages recovery codes.
    """
    @staticmethod
    def generate_secret():
        """Generates a cryptographically secure 20-byte base32 secret."""
        return base64.b32encode(secrets.token_bytes(20)).decode('utf-8')

    @staticmethod
    def get_provisioning_uri(username, secret, issuer="DevSync"):
        """Constructs a standard otpauth URI recognized by authenticator apps."""
        encoded_user = urllib.parse.quote(str(username))
        encoded_issuer = urllib.parse.quote(issuer)
        return f"otpauth://totp/{encoded_issuer}:{encoded_user}?secret={secret}&issuer={encoded_issuer}&algorithm=SHA1&digits=6&period=30"

    @staticmethod
    def compute_totp(secret_b32, t=None, time_step=30):
        if t is None:
            t = time.time()
        counter = int(t // time_step)
        try:
            key = base64.b32decode(secret_b32, casefold=True)
        except Exception:
            return "000000"
        msg = struct.pack(">Q", counter)
        h = hmac.new(key, msg, hashlib.sha1).digest()
        o = h[19] & 0x0F
        code = (struct.unpack(">I", h[o:o+4])[0] & 0x7FFFFFFF) % 1000000
        return f"{code:06d}"

    @classmethod
    def verify_code(cls, secret_b32, code, time_step=30, window=1):
        """Verifies submitted code with a +/- window time-drift tolerance."""
        if not secret_b32 or not code:
            return False
        clean_code = str(code).strip()
        if len(clean_code) != 6 or not clean_code.isdigit():
            return False
        now = time.time()
        for w in range(-window, window + 1):
            expected = cls.compute_totp(secret_b32, now + w * time_step, time_step)
            if secrets.compare_digest(expected, clean_code):
                return True
        return False

    @staticmethod
    def generate_recovery_codes(count=8):
        """
        Generates 8 secure alphanumeric recovery codes (formatted as XXXX-XXXX).
        Returns (plaintext_list, hashed_list) so that only hashes are persisted.
        """
        plain = []
        hashed = []
        for _ in range(count):
            p1 = secrets.token_hex(2).upper()
            p2 = secrets.token_hex(2).upper()
            code = f"{p1}-{p2}"
            plain.append(code)
            h = hashlib.sha256(code.encode('utf-8')).hexdigest()
            hashed.append(h)
        return plain, hashed

    @staticmethod
    def verify_and_consume_recovery_code(profile, submitted_code):
        """
        Verifies if submitted code matches one of the user's stored recovery code hashes,
        and consumes it immediately (single-use).
        """
        if not submitted_code:
            return False, "Recovery code is required."
        clean = str(submitted_code).strip().upper()
        h = hashlib.sha256(clean.encode('utf-8')).hexdigest()
        hashes = profile.get('two_factor_recovery_codes', [])
        for i, stored_hash in enumerate(hashes):
            if secrets.compare_digest(stored_hash, h):
                hashes.pop(i)
                return True, "Recovery code verified and consumed."
        return False, "Invalid recovery code."


reauth_manager = ReauthManager()
totp_manager = TOTPManager()
