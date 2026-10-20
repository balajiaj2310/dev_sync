import base64
import hashlib
import hmac
import secrets
import struct
import time


class TOTPManager:
    """
    Pure Python RFC 6238 TOTP Implementation.
    Compatible with Google Authenticator, Microsoft Authenticator, 1Password.
    """

    TIME_STEP = 30
    CODE_DIGITS = 6

    @classmethod
    def generate_secret(cls) -> str:
        random_bytes = secrets.token_bytes(20)
        return base64.b32encode(random_bytes).decode("utf-8").rstrip("=")

    @classmethod
    def compute_totp(cls, secret_base32: str, for_time: float = None) -> str:
        if for_time is None:
            for_time = time.time()
        time_counter = int(for_time // cls.TIME_STEP)

        # Pad base32 secret
        padded = secret_base32.upper() + "=" * ((8 - len(secret_base32) % 8) % 8)
        key = base64.b32decode(padded)
        msg = struct.pack(">Q", time_counter)

        h = hmac.new(key, msg, hashlib.sha1).digest()
        offset = h[-1] & 0x0F
        code_int = struct.unpack(">I", h[offset : offset + 4])[0] & 0x7FFFFFFF
        return f"{code_int % (10 ** cls.CODE_DIGITS):06d}"

    @classmethod
    def verify_code(
        cls, secret_base32: str, candidate_code: str, window: int = 1
    ) -> bool:
        candidate = str(candidate_code).strip()
        if len(candidate) != 6 or not candidate.isdigit():
            return False

        now = time.time()
        for step_offset in range(-window, window + 1):
            expected = cls.compute_totp(
                secret_base32, now + (step_offset * cls.TIME_STEP)
            )
            if secrets.compare_digest(expected, candidate):
                return True
        return False

    @classmethod
    def get_provisioning_uri(
        cls, username: str, secret: str, issuer: str = "DevSync"
    ) -> str:
        return f"otpauth://totp/{issuer}:{username}?secret={secret}&issuer={issuer}&algorithm=SHA1&digits=6&period=30"

    @classmethod
    def generate_recovery_codes(cls, count: int = 8):
        plain_codes = []
        for _ in range(count):
            p1 = secrets.token_hex(2).upper()
            p2 = secrets.token_hex(2).upper()
            plain_codes.append(f"{p1}-{p2}")
        return plain_codes
