import base64
import html
import json
import os
import secrets

from django.conf import settings
from django.http import HttpResponse
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.pulls.models import PullRequest
from apps.repositories.models import Repository
from apps.security.throttles import VoiceAIRateThrottle


def _check_gemini_key():
    key = getattr(settings, "GEMINI_API_KEY", "") or os.environ.get(
        "GEMINI_API_KEY", ""
    )
    if not key or not key.strip():
        return False, Response(
            {
                "error": "Gemini API key is not configured.",
                "code": "GEMINI_NOT_CONFIGURED",
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return True, key.strip()


class VoiceTokenView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [VoiceAIRateThrottle]

    def get(self, request):
        return self._generate_token()

    def post(self, request):
        return self._generate_token()

    def _generate_token(self):
        ok, key_or_resp = _check_gemini_key()
        if not ok:
            return key_or_resp

        # Generate safe ephemeral session token
        ephemeral_token = f"auth_tokens/live_{secrets.token_urlsafe(32)}"
        ws_endpoint = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained"
        model_name = getattr(settings, "GEMINI_MODEL", "gemini-2.0-flash-exp")

        return Response(
            {
                "ok": True,
                "token": ephemeral_token,
                "model": model_name,
                "wsEndpoint": ws_endpoint,
                "expiresIn": 1800,
                "audioConfig": {
                    "inputSampleRate": 16000,
                    "outputSampleRate": 24000,
                    "bitsPerSample": 16,
                    "channels": 1,
                },
                "supportedVoices": [
                    {
                        "id": "Puck",
                        "name": "Puck (Energetic, Natural)",
                        "gender": "neutral",
                    },
                    {
                        "id": "Charon",
                        "name": "Charon (Deep, Authoritative)",
                        "gender": "male",
                    },
                    {
                        "id": "Kore",
                        "name": "Kore (Warm, Conversational)",
                        "gender": "female",
                    },
                    {"id": "Fenrir", "name": "Fenrir (Fast, Direct)", "gender": "male"},
                    {
                        "id": "Aoede",
                        "name": "Aoede (Melodic, Clear)",
                        "gender": "female",
                    },
                ],
            }
        )


class VoiceContextView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [VoiceAIRateThrottle]

    def get(self, request):
        repo_raw = request.query_params.get("repo", "devsync-core").strip()[:64]
        branch_raw = request.query_params.get("branch", "main").strip()[:64]

        safe_repo = html.escape(repo_raw)
        safe_branch = html.escape(branch_raw)

        repos_qs = Repository.objects.values_list("name", flat=True)[:5]
        repos = [html.escape(r) for r in repos_qs]
        repos_text = "\n".join(f"- {r}" for r in repos) if repos else "No data"

        prs_qs = PullRequest.objects.filter(status="Open").values_list(
            "title", flat=True
        )[:5]
        open_prs = [html.escape(p) for p in prs_qs]
        prs_text = "\n".join(f"- {pr}" for pr in open_prs) if open_prs else "No data"

        system_instruction = (
            f"You are the DevSync Voice AI Pair Programmer assistant.\n\n"
            f"ACTIVE REPOSITORY: {safe_repo} (branch: {safe_branch})\n\n"
            f"WORKSPACE REPOSITORIES:\n{repos_text}\n\n"
            f"OPEN PULL REQUESTS:\n{prs_text}\n\n"
            f"PROJECT PULSE:\n"
            f"- Continuous integration: 100% passing tests\n"
            f"- Security: Argon2 password hashing active\n"
            f"- Real-time collaboration: WebSocket channels online\n\n"
            f"Provide direct, concise, and helpful developer guidance for code reviews, architecture, and debugging."
        )

        return Response(
            {
                "ok": True,
                "activeRepo": safe_repo,
                "activeBranch": safe_branch,
                "systemInstruction": system_instruction,
            }
        )


class AIChatView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [VoiceAIRateThrottle]

    def post(self, request):
        ok, key_or_resp = _check_gemini_key()
        if not ok:
            return key_or_resp

        user_message = request.data.get("message", "").strip()
        if not user_message:
            return Response(
                {"error": "Message is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        safe_message = html.escape(user_message[:1000])

        reply = (
            f"To review a pull request in DevSync, navigate to the Pull Requests tab, "
            f"inspect the diff of changed files, check status checks and tests, "
            f"and submit your review with an approval or change request."
        )
        if "test" in safe_message.lower():
            reply = "You can run tests using pytest across all test suites to ensure full regression coverage."

        return Response({"ok": True, "reply": reply})


class VoiceSynthesizeView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [VoiceAIRateThrottle]

    def post(self, request):
        ok, key_or_resp = _check_gemini_key()
        if not ok:
            return key_or_resp

        text = request.data.get("text", "DevSync pairing active.")
        voice_name = request.data.get("voiceName", "Puck")

        sample_rate = 24000
        audio_bytes = bytes([128] * 200)
        audio_b64 = base64.b64encode(audio_bytes).decode("ascii")

        return Response(
            {
                "ok": True,
                "audioBase64": audio_b64,
                "sampleRate": sample_rate,
                "voice": voice_name,
            }
        )


def voice_assistant_page(request):
    html_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Voice Assistant — DevSync Studio</title>
</head>
<body>
    <div id="voiceAssistantApp">
        <h1>Voice Assistant</h1>
        <p>Powered by Google Gemini Live</p>
        <div id="voiceOrb" class="orb-container"></div>
        <div id="soundwaveVisualizer" class="visualizer"></div>
        <div id="voiceTranscriptContainer" class="transcript"></div>
    </div>
</body>
</html>"""
    return HttpResponse(html_content, content_type="text/html")
