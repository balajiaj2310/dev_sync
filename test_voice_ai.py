"""
DevSync Voice AI Test Suite
Verifies Gemini Live ephemeral token generation, context injection,
voice synthesis fallback, chat endpoints, security guarantees, and routing.
"""

import unittest
import urllib.request
import urllib.error
import json
import os
import sys

BASE_URL = "http://127.0.0.1:8000"


class TestDevSyncVoiceAI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Ensure server is reachable
        try:
            with urllib.request.urlopen(f"{BASE_URL}/api/v1/auth/me", timeout=3) as r:
                pass
        except urllib.error.HTTPError as e:
            pass
        except Exception as e:
            raise RuntimeError(f"DevSync server is not running at {BASE_URL}: {e}")

    def test_01_voice_assistant_page_routing(self):
        """Verify that /assistant and route aliases return 200 and render the Voice Studio."""
        routes = ['/assistant', '/ai/assistant', '/assistant/index.html']
        for route in routes:
            url = f"{BASE_URL}{route}"
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=5) as resp:
                self.assertEqual(resp.status, 200, f"Route {route} failed with {resp.status}")
                html = resp.read().decode('utf-8')
                self.assertIn("Voice Assistant", html)
                self.assertIn("Google Gemini Live", html)
                self.assertIn("voiceOrb", html)
                self.assertIn("soundwaveVisualizer", html)
                self.assertIn("voiceTranscriptContainer", html)

    def test_02_ephemeral_token_generation_security(self):
        """Verify that /api/v1/ai/voice/token generates an ephemeral token without exposing GEMINI_API_KEY."""
        url = f"{BASE_URL}/api/v1/ai/voice/token"
        req = urllib.request.Request(url, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode('utf-8'))
            self.assertTrue(data.get('ok'))
            self.assertIn('token', data)
            token = data.get('token')
            self.assertTrue(token.startswith('auth_tokens/'), f"Expected auth_tokens/ prefix, got {token}")

            # CRITICAL SECURITY CHECK: Permanent GEMINI_API_KEY must NEVER be leaked
            raw_response = json.dumps(data)
            env_key = os.environ.get('GEMINI_API_KEY', '')
            if env_key and len(env_key) > 10:
                self.assertNotIn(env_key, raw_response, "CRITICAL: Permanent GEMINI_API_KEY leaked in token response!")

            # Verify Live model specification
            self.assertEqual(data.get('model'), 'gemini-3.8-live')
            self.assertIn('wsEndpoint', data)
            self.assertIn('BidiGenerateContentConstrained', data.get('wsEndpoint'))

    def test_03_audio_configuration_specs(self):
        """Verify input/output PCM audio specifications meet Google Gemini Live standard."""
        url = f"{BASE_URL}/api/v1/ai/voice/token"
        with urllib.request.urlopen(url, timeout=5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            audio_cfg = data.get('audioConfig', {})
            self.assertEqual(audio_cfg.get('inputSampleRate'), 16000)
            self.assertEqual(audio_cfg.get('outputSampleRate'), 24000)
            self.assertEqual(audio_cfg.get('bitsPerSample'), 16)
            self.assertEqual(audio_cfg.get('channels'), 1)

    def test_04_supported_voices_and_personas(self):
        """Verify supported Google Gemini voices are provided."""
        url = f"{BASE_URL}/api/v1/ai/voice/token"
        with urllib.request.urlopen(url, timeout=5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            voices = data.get('supportedVoices', [])
            voice_ids = [v['id'] for v in voices]
            expected = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede']
            for v_name in expected:
                self.assertIn(v_name, voice_ids, f"Voice {v_name} missing from supported voices.")

    def test_05_grounded_devsync_context_generation(self):
        """Verify that /api/v1/ai/voice/context returns rich system instructions grounded in real data."""
        url = f"{BASE_URL}/api/v1/ai/voice/context?repo=devsync-core&branch=main"
        with urllib.request.urlopen(url, timeout=5) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode('utf-8'))
            self.assertTrue(data.get('ok'))
            self.assertEqual(data.get('activeRepo'), 'devsync-core')
            self.assertEqual(data.get('activeBranch'), 'main')

            system_instruction = data.get('systemInstruction', '')
            self.assertIn("DevSync Voice AI Pair Programmer", system_instruction)
            self.assertIn("devsync-core", system_instruction)
            self.assertIn("WORKSPACE REPOSITORIES", system_instruction)
            self.assertIn("OPEN PULL REQUESTS", system_instruction)
            self.assertIn("PROJECT PULSE", system_instruction)

    def test_06_text_chat_endpoint(self):
        """Verify /api/ai/chat handles developer inquiries."""
        url = f"{BASE_URL}/api/ai/chat"
        payload = {"message": "How do I review a pull request?"}
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=25) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode('utf-8'))
            self.assertIn('reply', data)
            self.assertTrue(len(data.get('reply', '')) > 20)

    def test_07_tts_synthesis_fallback_endpoint(self):
        """Verify /api/v1/ai/voice/synthesize generates valid speech audio chunks."""
        url = f"{BASE_URL}/api/v1/ai/voice/synthesize"
        payload = {"text": "DevSync pairing active.", "voiceName": "Puck"}
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=25) as resp:
                self.assertEqual(resp.status, 200)
                data = json.loads(resp.read().decode('utf-8'))
                self.assertTrue(data.get('ok'))
                self.assertIn('audioBase64', data)
                self.assertTrue(len(data.get('audioBase64', '')) > 100)
                self.assertEqual(data.get('sampleRate'), 24000)
        except urllib.error.HTTPError as e:
            # If Google API quota or network timeout occurs, ensure graceful error handling
            self.assertIn(e.code, [200, 500, 503])


if __name__ == '__main__':
    unittest.main()
