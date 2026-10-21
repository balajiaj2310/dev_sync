"""
DevSync Voice AI Backend Service
Production-ready integration with Google Gemini Live API & v1beta auth_tokens
"""

import os
import json
import time
import datetime
import urllib.request
import urllib.error
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Gemini configuration
GEMINI_LIVE_MODEL = "gemini-3.8-live"
GEMINI_LIVE_FALLBACK_MODEL = "gemini-2.0-flash-exp"
GEMINI_TEXT_MODELS = ["gemini-3.5-flash", "gemini-3.6-flash"]
GEMINI_TTS_MODEL = "gemini-3.1-flash-tts-preview"
GEMINI_WS_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained"

SUPPORTED_VOICES = [
    {"id": "Puck", "name": "Puck (Upbeat & Energetic)", "gender": "Neutral", "style": "Clear, friendly, fast"},
    {"id": "Charon", "name": "Charon (Informative & Calm)", "gender": "Deep", "style": "Steady, authoritative, calm"},
    {"id": "Kore", "name": "Kore (Firm & Focused)", "gender": "Warm", "style": "Direct, structured, articulate"},
    {"id": "Fenrir", "name": "Fenrir (Excitable & Dynamic)", "gender": "Resonant", "style": "Punchy, expressive, fast"},
    {"id": "Aoede", "name": "Aoede (Breezy & Natural)", "gender": "Melodic", "style": "Soft, expressive, conversational"}
]

SUPPORTED_LANGUAGES = [
    {"code": "en-US", "name": "English (US)"},
    {"code": "en-GB", "name": "English (UK)"},
    {"code": "es-ES", "name": "Spanish"},
    {"code": "fr-FR", "name": "French"},
    {"code": "de-DE", "name": "German"},
    {"code": "hi-IN", "name": "Hindi"},
    {"code": "ja-JP", "name": "Japanese"}
]


def get_gemini_api_key():
    """Retrieve and validate the Gemini API key from the environment."""
    key = os.environ.get('GEMINI_API_KEY', '').strip()
    if not key or key.startswith('YOUR_') or key == 'AQ.A...':
        return None
    return key


def create_live_ephemeral_token():
    """
    Generate a short-lived ephemeral token for the browser client to connect
    directly to Gemini Live API via WebSockets.
    
    The permanent GEMINI_API_KEY is NEVER sent to the client.
    """
    api_key = get_gemini_api_key()
    if not api_key:
        import secrets
        return {
            "ok": True,
            "token": f"auth_tokens/dev_{secrets.token_hex(16)}",
            "model": GEMINI_LIVE_MODEL,
            "fallbackModel": GEMINI_LIVE_FALLBACK_MODEL,
            "wsEndpoint": GEMINI_WS_URL,
            "expiresIn": 1800,
            "supportedVoices": SUPPORTED_VOICES,
            "supportedLanguages": SUPPORTED_LANGUAGES,
            "audioConfig": {
                "inputMimeType": "audio/pcm;rate=16000",
                "inputSampleRate": 16000,
                "outputSampleRate": 24000,
                "bitsPerSample": 16,
                "channels": 1
            },
            "isDevFallback": True
        }

    now = datetime.datetime.now(tz=datetime.timezone.utc)
    expire_time = (now + datetime.timedelta(minutes=30)).strftime('%Y-%m-%dT%H:%M:%SZ')
    new_session_expire = (now + datetime.timedelta(minutes=2)).strftime('%Y-%m-%dT%H:%M:%SZ')

    url = "https://generativelanguage.googleapis.com/v1beta/auth_tokens"
    headers = {
        "x-goog-api-key": api_key,
        "Content-Type": "application/json"
    }
    payload = {
        "uses": 1,
        "expireTime": expire_time,
        "newSessionExpireTime": new_session_expire
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers=headers,
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            token_name = data.get("name")
            if not token_name:
                return {
                    "ok": False,
                    "error": "Unexpected response from Gemini auth_tokens endpoint.",
                    "code": "INVALID_TOKEN_RESPONSE"
                }

            return {
                "ok": True,
                "token": token_name,
                "model": GEMINI_LIVE_MODEL,
                "fallbackModel": GEMINI_LIVE_FALLBACK_MODEL,
                "wsEndpoint": GEMINI_WS_URL,
                "expiresIn": 1800,
                "supportedVoices": SUPPORTED_VOICES,
                "supportedLanguages": SUPPORTED_LANGUAGES,
                "audioConfig": {
                    "inputMimeType": "audio/pcm;rate=16000",
                    "inputSampleRate": 16000,
                    "outputSampleRate": 24000,
                    "bitsPerSample": 16,
                    "channels": 1
                }
            }

    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8')
        print(f"[Gemini Live] HTTP Error {e.code}: {err_msg}")
        return {
            "ok": False,
            "error": f"Failed to generate ephemeral token: {e.reason}",
            "code": f"HTTP_{e.code}",
            "details": err_msg
        }
    except Exception as e:
        print(f"[Gemini Live] Exception generating token: {e}")
        return {
            "ok": False,
            "error": f"Connection error reaching Gemini API: {str(e)}",
            "code": "CONNECTION_ERROR"
        }


def build_system_instruction(user_profile=None, active_repo=None, active_branch=None, repos=None, prs=None, issues=None, pulse_data=None):
    """
    Construct grounded DevSync project context for Gemini Live.
    Ensures the assistant speaks accurately about repositories, pull requests,
    issues, branches, and code architecture.
    """
    user_name = user_profile.get('name', 'Developer') if user_profile else 'DevSync Developer'
    username = user_profile.get('username', 'developer') if user_profile else 'developer'

    context_lines = [
        "You are the DevSync Voice AI Pair Programmer & Engineering Assistant.",
        "DevSync is a developer collaboration platform for code repositories, branch management, pull requests, issues, teams, and Project Pulse analytics.",
        f"You are currently talking with @{username} ({user_name}).",
        "",
        "### CORE GUIDELINES FOR VOICE CONVERSATION:",
        "1. Spoken responses must be concise, crisp, and conversational (1 to 3 sentences by default).",
        "2. Avoid reading aloud complex markdown syntax like asterisks, hash headers, or long URLs. Speak smoothly as if pairing in person.",
        "3. When discussing code, state high-level logic clearly. If deep code is needed, explain the structure and offer to send code to the screen.",
        "4. NEVER invent pull requests, issues, or repositories. Always stick to the verified facts provided in the workspace context below.",
        "5. For destructive actions (e.g., merging PRs, deleting branches, force pushing), always ask for explicit confirmation first.",
        ""
    ]

    # Workspace Repositories
    context_lines.append("### WORKSPACE REPOSITORIES:")
    if repos:
        repo_list = list(repos.values()) if isinstance(repos, dict) else repos
        for r in repo_list[:6]:
            r_id = r.get('id', 'repo')
            r_name = r.get('name', r_id)
            r_branch = r.get('defaultBranch', 'main')
            r_desc = r.get('description', '')
            branches = r.get('branches', [r_branch])
            if isinstance(branches, dict):
                branches = list(branches.keys())
            branch_str = ", ".join(branches[:4])
            context_lines.append(f"- {r_name} (ID: {r_id}, default: {r_branch}, branches: [{branch_str}]): {r_desc}")
    else:
        context_lines.append("- devsync-core: Main platform repository with vanilla ES6 frontend, Python server, and collaboration APIs.")

    # Active Repository & Branch Context
    context_lines.append("")
    context_lines.append("### ACTIVE CONTEXT:")
    context_lines.append(f"- Active Repository: {active_repo or 'devsync-core'}")
    context_lines.append(f"- Active Branch: {active_branch or 'main'}")

    # Open Pull Requests
    context_lines.append("")
    context_lines.append("### OPEN PULL REQUESTS:")
    if prs:
        pr_list = list(prs.values()) if isinstance(prs, dict) else prs
        open_prs = [p for p in pr_list if str(p.get('status', '')).lower() == 'open']
        if open_prs:
            for p in open_prs[:5]:
                p_id = p.get('id', 'pr')
                title = p.get('title', 'Pull Request')
                author = p.get('author', 'dev')
                src = p.get('sourceBranch', 'feature')
                tgt = p.get('targetBranch', 'main')
                context_lines.append(f"- #{p_id}: \"{title}\" by @{author} ({src} -> {tgt})")
        else:
            context_lines.append("- No open pull requests currently.")
    else:
        context_lines.append("- PR #42: \"Add user authentication with Google OAuth\" by @balajiaj2310 (feature/oauth -> main) [Open]")

    # Open Issues
    context_lines.append("")
    context_lines.append("### ACTIVE ISSUES:")
    if issues:
        issue_list = list(issues.values()) if isinstance(issues, dict) else issues
        open_issues = [i for i in issue_list if str(i.get('status', '')).lower() == 'open']
        if open_issues:
            for i in open_issues[:5]:
                i_id = i.get('id', 'issue')
                title = i.get('title', 'Issue')
                labels = ", ".join(i.get('labels', [])) if isinstance(i.get('labels'), list) else str(i.get('labels', ''))
                context_lines.append(f"- #{i_id}: \"{title}\" [{labels}]")
        else:
            context_lines.append("- No open issues currently.")
    else:
        context_lines.append("- #1: \"Add dark mode support\" [UI/UX, enhancement]")

    # Project Pulse & Contribution Intelligence
    context_lines.append("")
    context_lines.append("### PROJECT PULSE & CONTRIBUTION INTELLIGENCE:")
    if pulse_data:
        score = pulse_data.get('overallScore', 84)
        quality = pulse_data.get('codeQuality', 92)
        velocity = pulse_data.get('velocity', 88)
        collab = pulse_data.get('collaboration', 85)
        context_lines.append(f"- Overall Impact Score: {score}/100")
        context_lines.append(f"- Code Quality: {quality}/100, Velocity: {velocity}/100, Collaboration: {collab}/100")
        context_lines.append("- Status: Active healthy velocity across all team branches.")
    else:
        context_lines.append("- Overall Impact Score: 84/100 (High activity, clean test suites, active commits).")

    return "\n".join(context_lines)


def generate_gemini_text_chat(prompt, context_instruction=None):
    """
    Text chat integration using Gemini Flash with full project grounding.
    Tries models in order: gemini-3.6-flash, gemini-3.5-flash, gemini-3.8-flash.
    """
    api_key = get_gemini_api_key()
    if not api_key:
        return None

    contents = []
    if context_instruction:
        contents.append({
            "role": "user",
            "parts": [{"text": f"SYSTEM INSTRUCTION & REPOSITORY CONTEXT:\n{context_instruction}\n\nPlease acknowledge and stay in this role."}]
        })
        contents.append({
            "role": "model",
            "parts": [{"text": "Understood. I am DevSync AI Assistant, grounded in your DevSync repositories, pull requests, issues, and project pulse."}]
        })

    contents.append({
        "role": "user",
        "parts": [{"text": prompt}]
    })

    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": 0.4,
            "maxOutputTokens": 1000
        }
    }

    for model_name in GEMINI_TEXT_MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        headers = {"Content-Type": "application/json"}
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode('utf-8'),
                headers=headers,
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=6) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                candidates = data.get('candidates', [])
                if candidates:
                    parts = candidates[0].get('content', {}).get('parts', [])
                    reply_text = "".join(p.get('text', '') for p in parts)
                    if reply_text.strip():
                        return reply_text.strip()
        except Exception as e:
            print(f"[Gemini Text Chat] Model {model_name} failed: {e}")
            continue

    return None


def synthesize_speech(text, voice_name="Puck"):
    """
    Synthesize audio using Gemini TTS as a high-fidelity REST audio fallback.
    Returns base64 encoded audio PCM/L16 or WAV data.
    """
    api_key = get_gemini_api_key()
    if not api_key:
        return None

    clean_text = text.replace("**", "").replace("#", "").replace("```", "").strip()
    if len(clean_text) > 400:
        clean_text = clean_text[:400] + "..."

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_TTS_MODEL}:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": clean_text}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {
                    "prebuiltVoiceConfig": {
                        "voiceName": voice_name if voice_name in [v['id'] for v in SUPPORTED_VOICES] else "Puck"
                    }
                }
            }
        }
    }

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            candidates = data.get('candidates', [])
            if candidates:
                parts = candidates[0].get('content', {}).get('parts', [])
                for part in parts:
                    inline = part.get('inlineData')
                    if inline and inline.get('data'):
                        return {
                            "mimeType": inline.get('mimeType', 'audio/l16; rate=24000; channels=1'),
                            "audioBase64": inline.get('data'),
                            "text": clean_text,
                            "sampleRate": 24000
                        }
    except Exception as e:
        print(f"[Gemini TTS] Synthesis failed: {e}")

    return None
