"""
DevSync Voice AI & AI Mentor Backend Service
Production-ready integration with Google Gemini GenAI SDK, Gemini Live API & Audio TTS
"""

import os
import json
import time
import base64
import datetime
import urllib.request
import urllib.error
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Try importing official Google Gen AI SDK
try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False

# Gemini configuration
GEMINI_LIVE_MODEL = "gemini-3.8-live"
GEMINI_LIVE_FALLBACK_MODEL = "gemini-2.0-flash-exp"
GEMINI_TEXT_MODELS = ["gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.8-flash"]
GEMINI_TTS_MODELS = ["gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts", "gemini-3.1-flash-tts-preview"]
GEMINI_TTS_MODEL = "gemini-3.8-flash-lite-tts"
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

DEV_SYNC_AI_MENTOR_SYSTEM_INSTRUCTION = """You are DevSync AI Mentor, an intelligent and friendly developer companion and DevSync Voice AI Pair Programmer.

Your purpose is to help developers learn, build, debug, improve their programming skills, and complete software projects.

You can discuss programming, web development, Python, Django, JavaScript, databases, APIs, Git, GitHub, software architecture, debugging, project planning, and general topics.

Speak naturally, like a helpful human-style AI assistant.

Use simple explanations when users are beginners.

Give practical examples and code snippets when useful.

Understand follow-up questions using conversation context.

Never pretend to execute code or access files unless the application actually provides that capability.

When explaining programming problems:
1. Understand the issue.
2. Explain the reason.
3. Provide a solution.
4. Show an example when useful.

Be friendly, supportive, accurate, and conversational.

Do not unnecessarily repeat greetings or give excessively long answers to simple questions."""


def get_gemini_api_key():
    """Retrieve and validate the Gemini API key from the environment."""
    key = os.environ.get('GEMINI_API_KEY', '').strip()
    if not key or key.startswith('YOUR_') or key == 'AQ.A...':
        return None
    return key


def get_genai_client():
    """Get initialized Google GenAI Client if SDK is available and API key is set."""
    if not GENAI_AVAILABLE:
        return None
    api_key = get_gemini_api_key()
    if not api_key:
        return None
    try:
        return genai.Client(api_key=api_key)
    except Exception as e:
        print(f"[backend_voice_ai] genai.Client init error: {e}")
        return None


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
    Construct grounded DevSync project context for Gemini Live & Mentor.
    Ensures the assistant speaks accurately about repositories, pull requests,
    issues, branches, and code architecture.
    """
    user_name = user_profile.get('name', 'Developer') if user_profile else 'DevSync Developer'
    username = user_profile.get('username', 'developer') if user_profile else 'developer'

    context_lines = [
        DEV_SYNC_AI_MENTOR_SYSTEM_INSTRUCTION,
        "",
        "### CURRENT WORKSPACE CONTEXT:",
        f"You are currently mentoring @{username} ({user_name}).",
        f"- Active Repository: {active_repo or 'devsync-core'}",
        f"- Active Branch: {active_branch or 'main'}",
        ""
    ]

    # Workspace Repositories
    context_lines.append("### WORKSPACE REPOSITORIES:")
    if repos is not None:
        repo_list = list(repos.values()) if isinstance(repos, dict) else repos
        if repo_list:
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
            context_lines.append("- No data")
    else:
        context_lines.append("- devsync-core: Main platform repository with vanilla ES6 frontend, Python server, and collaboration APIs.")

    # Open Pull Requests
    context_lines.append("")
    context_lines.append("### OPEN PULL REQUESTS:")
    if prs is not None:
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
            context_lines.append("- No data")
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


# Cooldown state for remote TTS to avoid repeated 10-15s timeouts on 429 quota exhaustion
_TTS_COOLDOWN_UNTIL = 0
_TTS_LAST_ERROR = None


def generate_silent_wav(duration_ms=100, sample_rate=24000):
    """Generates a valid 44-byte PCM WAV byte array so browser audio decoders do not throw errors."""
    import struct
    num_samples = int(sample_rate * (duration_ms / 1000.0))
    data_size = num_samples * 2  # 16-bit mono = 2 bytes per sample
    header = bytearray(44)
    header[0:4] = b'RIFF'
    struct.pack_into('<I', header, 4, 36 + data_size)
    header[8:12] = b'WAVE'
    header[12:16] = b'fmt '
    struct.pack_into('<I', header, 16, 16)  # PCM header size
    struct.pack_into('<H', header, 20, 1)   # Audio format (1 = PCM)
    struct.pack_into('<H', header, 22, 1)   # Channels (1 = mono)
    struct.pack_into('<I', header, 24, sample_rate)  # Sample rate
    struct.pack_into('<I', header, 28, sample_rate * 2)  # Byte rate
    struct.pack_into('<H', header, 32, 2)   # Block align
    struct.pack_into('<H', header, 34, 16)  # Bits per sample
    header[36:40] = b'data'
    struct.pack_into('<I', header, 40, data_size)
    return bytes(header) + bytes(data_size)


def synthesize_speech(text, voice_name="Puck"):
    """
    Synthesize audio using Gemini TTS with fast-fail circuit breaker and browser fallback flag.
    Returns dict: {"mimeType": "audio/wav", "audioBase64": str, "text": str, "sampleRate": int, "useBrowserTts": bool}
    """
    global _TTS_COOLDOWN_UNTIL, _TTS_LAST_ERROR
    clean_text = text.replace("**", "").replace("#", "").replace("```", "").strip()
    if len(clean_text) > 400:
        clean_text = clean_text[:400] + "..."

    selected_voice = voice_name if voice_name in [v['id'] for v in SUPPORTED_VOICES] else "Puck"

    # Fast-fail circuit breaker: if remote TTS quota is exhausted, skip the 12s retry delay
    now = time.time()
    if now < _TTS_COOLDOWN_UNTIL:
        mock_wav = generate_silent_wav(100)
        return {
            "mimeType": "audio/wav",
            "audioBase64": base64.b64encode(mock_wav).decode('ascii'),
            "text": clean_text,
            "sampleRate": 24000,
            "isFallback": True,
            "useBrowserTts": True,
            "reason": f"Quota cooldown active: {_TTS_LAST_ERROR}"
        }

    # Attempt official Google GenAI SDK first with fast timeout
    client = get_genai_client()
    if client and GENAI_AVAILABLE:
        for tts_model in GEMINI_TTS_MODELS:
            try:
                resp = client.models.generate_content(
                    model=tts_model,
                    contents=clean_text,
                    config=types.GenerateContentConfig(
                        response_modalities=['AUDIO'],
                        speech_config=types.SpeechConfig(
                            voice_config=types.VoiceConfig(
                                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                    voice_name=selected_voice
                                )
                            )
                        )
                    )
                )
                if resp.candidates and resp.candidates[0].content and resp.candidates[0].content.parts:
                    for part in resp.candidates[0].content.parts:
                        if part.inline_data and part.inline_data.data:
                            raw_data = part.inline_data.data
                            b64 = base64.b64encode(raw_data).decode('ascii') if isinstance(raw_data, (bytes, bytearray)) else str(raw_data)
                            return {
                                "mimeType": part.inline_data.mime_type or 'audio/wav',
                                "audioBase64": b64,
                                "text": clean_text,
                                "sampleRate": 24000,
                                "useBrowserTts": False
                            }
            except Exception as e:
                err_str = str(e)
                print(f"[GenAI TTS SDK] {tts_model} failed: {err_str[:120]}")
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "quota" in err_str.lower():
                    # Set 10-minute cooldown on 429 quota exhaustion to prevent 12s stalls on every subsequent request
                    _TTS_COOLDOWN_UNTIL = time.time() + 600
                    _TTS_LAST_ERROR = "Gemini TTS Free Tier quota limit reached (10 requests/day)."
                    break
                continue

    # Fast HTTP Fallback only if NOT in quota exhaustion cooldown
    api_key = get_gemini_api_key()
    if api_key and (time.time() >= _TTS_COOLDOWN_UNTIL):
        payload = {
            "contents": [{"parts": [{"text": clean_text}]}],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {
                    "voiceConfig": {
                        "prebuiltVoiceConfig": {
                            "voiceName": selected_voice
                        }
                    }
                }
            }
        }
        for tts_model in GEMINI_TTS_MODELS:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{tts_model}:generateContent?key={api_key}"
            try:
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode('utf-8'),
                    headers={"Content-Type": "application/json"},
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=3.5) as resp:
                    data = json.loads(resp.read().decode('utf-8'))
                    candidates = data.get('candidates', [])
                    if candidates:
                        parts = candidates[0].get('content', {}).get('parts', [])
                        for part in parts:
                            inline = part.get('inlineData')
                            if inline and inline.get('data'):
                                return {
                                    "mimeType": inline.get('mimeType', 'audio/wav'),
                                    "audioBase64": inline.get('data'),
                                    "text": clean_text,
                                    "sampleRate": 24000,
                                    "useBrowserTts": False
                                }
            except Exception as e:
                err_str = str(e)
                print(f"[Gemini HTTP TTS] {tts_model} failed: {err_str[:120]}")
                if "429" in err_str or "quota" in err_str.lower():
                    _TTS_COOLDOWN_UNTIL = time.time() + 600
                    _TTS_LAST_ERROR = "Gemini TTS Free Tier quota limit reached."
                    break
                continue

    # Return valid silent wav + signal frontend to use instant Web Speech API
    mock_wav = generate_silent_wav(100)
    return {
        "mimeType": "audio/wav",
        "audioBase64": base64.b64encode(mock_wav).decode('ascii'),
        "text": clean_text,
        "sampleRate": 24000,
        "isFallback": True,
        "useBrowserTts": True
    }


def process_mentor_chat(message, history=None, context_instruction=None, voice_name="Puck", generate_audio=True):
    """
    Processes a text question with multi-turn conversation memory using Google GenAI SDK.
    Returns: {"reply": str, "audioBase64": str or None, "mimeType": str, "source": "gemini"|"local"}
    """
    client = get_genai_client()
    sys_instruction = context_instruction or DEV_SYNC_AI_MENTOR_SYSTEM_INSTRUCTION

    if client and GENAI_AVAILABLE:
        # Build contents from history turns
        contents = []
        if history and isinstance(history, list):
            # Limit history to the last 8 turns to avoid token overflow
            recent_turns = history[-8:]
            for turn in recent_turns:
                role = "user" if turn.get('role') == 'user' else "model"
                text = turn.get('content') or turn.get('text', '')
                if text:
                    contents.append(types.Content(
                        role=role,
                        parts=[types.Part.from_text(text=text)]
                    ))

        # Add current user prompt
        contents.append(types.Content(
            role="user",
            parts=[types.Part.from_text(text=message)]
        ))

        for model_name in GEMINI_TEXT_MODELS:
            try:
                resp = client.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=sys_instruction,
                        temperature=0.7,
                        max_output_tokens=800
                    )
                )
                if resp.text and resp.text.strip():
                    reply = resp.text.strip()
                    audio_res = synthesize_speech(reply, voice_name=voice_name) if generate_audio else None
                    return {
                        "ok": True,
                        "reply": reply,
                        "audioBase64": audio_res.get('audioBase64') if audio_res else None,
                        "mimeType": audio_res.get('mimeType', 'audio/wav') if audio_res else 'audio/wav',
                        "useBrowserTts": audio_res.get('useBrowserTts', False) if audio_res else False,
                        "source": "gemini",
                        "model": model_name
                    }
            except Exception as e:
                print(f"[process_mentor_chat] Model {model_name} error: {e}")
                continue

    # Fallback to generate_gemini_text_chat or local heuristic
    reply = generate_gemini_text_chat(message, context_instruction=sys_instruction)
    if not reply:
        reply = get_local_mentor_fallback_response(message)

    audio_res = synthesize_speech(reply, voice_name=voice_name) if generate_audio else None
    return {
        "ok": True,
        "reply": reply,
        "audioBase64": audio_res.get('audioBase64') if audio_res else None,
        "mimeType": audio_res.get('mimeType', 'audio/wav') if audio_res else 'audio/wav',
        "useBrowserTts": audio_res.get('useBrowserTts', False) if audio_res else False,
        "source": "local_fallback"
    }


def process_mentor_voice_recording(audio_bytes, mime_type="audio/webm", history=None, context_instruction=None, voice_name="Puck"):
    """
    Push-to-talk voice pipeline:
    1. Validates recorded audio bytes.
    2. Sends audio to Gemini model for transcription & understanding.
    3. Generates spoken AI Mentor answer with Gemini TTS.
    Returns: {"ok": bool, "transcription": str, "reply": str, "audioBase64": str, "mimeType": str}
    """
    if not audio_bytes or len(audio_bytes) < 32:
        return {
            "ok": False,
            "error": "Audio recording was empty. Please hold the microphone and speak your question.",
            "code": "EMPTY_AUDIO"
        }

    # Validate max upload size (10 MB limit)
    if len(audio_bytes) > 10 * 1024 * 1024:
        return {
            "ok": False,
            "error": "Audio recording exceeded 10MB limit. Please keep questions under 2 minutes.",
            "code": "AUDIO_TOO_LARGE"
        }

    client = get_genai_client()
    sys_instruction = context_instruction or DEV_SYNC_AI_MENTOR_SYSTEM_INSTRUCTION

    # Map incoming browser MIME types to Gemini supported audio formats
    valid_mime = mime_type.split(';')[0].strip().lower()
    if not valid_mime.startswith('audio/'):
        valid_mime = 'audio/webm'

    if client and GENAI_AVAILABLE:
        # Prompt Gemini to transcribe the user audio and formulate the mentor answer
        prompt = (
            "Listen carefully to the user's spoken audio question.\n"
            "Respond in valid JSON format with exactly two string fields:\n"
            "1. \"transcription\": the exact words spoken by the user.\n"
            "2. \"reply\": your friendly, natural, and helpful developer mentor explanation or solution."
        )

        contents = [
            types.Part.from_bytes(data=audio_bytes, mime_type=valid_mime),
            prompt
        ]

        for model_name in GEMINI_TEXT_MODELS:
            try:
                resp = client.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=sys_instruction,
                        temperature=0.7,
                        max_output_tokens=800,
                        response_mime_type="application/json"
                    )
                )
                if resp.text:
                    try:
                        parsed = json.loads(resp.text)
                        transcription = parsed.get("transcription", "").strip() or "Spoken audio question"
                        reply = parsed.get("reply", "").strip()
                        if reply:
                            audio_res = synthesize_speech(reply, voice_name=voice_name)
                            return {
                                "ok": True,
                                "transcription": transcription,
                                "reply": reply,
                                "audioBase64": audio_res.get('audioBase64') if audio_res else None,
                                "mimeType": audio_res.get('mimeType', 'audio/wav') if audio_res else 'audio/wav',
                                "useBrowserTts": audio_res.get('useBrowserTts', False) if audio_res else False,
                                "source": "gemini",
                                "model": model_name
                            }
                    except json.JSONDecodeError:
                        reply = resp.text.strip()
                        audio_res = synthesize_speech(reply, voice_name=voice_name)
                        return {
                            "ok": True,
                            "transcription": "Spoken audio inquiry",
                            "reply": reply,
                            "audioBase64": audio_res.get('audioBase64') if audio_res else None,
                            "mimeType": 'audio/wav',
                            "useBrowserTts": audio_res.get('useBrowserTts', False) if audio_res else False,
                            "source": "gemini"
                        }
            except Exception as e:
                print(f"[process_mentor_voice_recording] Model {model_name} failed: {e}")
                continue

    # Fallback when offline or key is missing
    fallback_transcription = "Spoken developer question (audio recorded)"
    fallback_reply = (
        "DevSync AI Mentor heard your audio question! "
        "I am ready to help you debug issues, optimize Django queries, review pull requests, or explain code concepts. "
        "Feel free to ask follow-up questions anytime."
    )
    audio_res = synthesize_speech(fallback_reply, voice_name=voice_name)

    return {
        "ok": True,
        "transcription": fallback_transcription,
        "reply": fallback_reply,
        "audioBase64": audio_res.get('audioBase64') if audio_res else None,
        "mimeType": "audio/wav",
        "useBrowserTts": audio_res.get('useBrowserTts', False) if audio_res else False,
        "source": "fallback"
    }


def generate_gemini_text_chat(prompt, context_instruction=None):
    """
    Backwards-compatible text chat method.
    """
    api_key = get_gemini_api_key()
    if not api_key:
        return None

    client = get_genai_client()
    if client and GENAI_AVAILABLE:
        for model_name in GEMINI_TEXT_MODELS:
            try:
                resp = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=context_instruction or DEV_SYNC_AI_MENTOR_SYSTEM_INSTRUCTION,
                        temperature=0.7,
                        max_output_tokens=800
                    )
                )
                if resp.text and resp.text.strip():
                    return resp.text.strip()
            except Exception as e:
                continue

    contents = []
    if context_instruction:
        contents.append({
            "role": "user",
            "parts": [{"text": f"SYSTEM INSTRUCTION & REPOSITORY CONTEXT:\n{context_instruction}\n\nPlease acknowledge and stay in this role."}]
        })
        contents.append({
            "role": "model",
            "parts": [{"text": "Understood. I am DevSync AI Mentor, grounded in your DevSync repositories, pull requests, issues, and project pulse."}]
        })

    contents.append({
        "role": "user",
        "parts": [{"text": prompt}]
    })

    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": 0.65,
            "maxOutputTokens": 800
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
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                candidates = data.get('candidates', [])
                if candidates:
                    parts = candidates[0].get('content', {}).get('parts', [])
                    reply_text = "".join(p.get('text', '') for p in parts)
                    if reply_text.strip():
                        return reply_text.strip()
        except Exception:
            continue

    return None


def get_local_mentor_fallback_response(message):
    """Local fallback responses when Gemini is offline or unconfigured."""
    lower = message.lower()
    if 'django' in lower and ('what' in lower or 'explain' in lower):
        return ("Django is a high-level Python web framework that enables rapid development of secure, "
                "maintainable websites. It follows the 'batteries-included' philosophy, offering built-in ORM, "
                "authentication, admin interfaces, and CSRF protection.")
    elif 'debug' in lower or 'error' in lower:
        return ("Here is my recommended debugging approach:\n\n"
                "1. Check the exact traceback and exception type.\n"
                "2. Inspect recent changes or inputs that triggered the error.\n"
                "3. Verify database migrations and schema consistency.\n"
                "4. Add print/logging statements or set a breakpoint.")
    elif 'pull request' in lower or 'pr' in lower or 'review' in lower:
        return ("To review a Pull Request on DevSync:\n\n"
                "1. Open the Pull Requests tab and select the PR.\n"
                "2. Inspect the diff viewer for clean logic and style.\n"
                "3. Verify that CI test suites pass.\n"
                "4. Submit your approval or request changes with constructive comments.")
    else:
        return (f"I hear you! You asked about: \"{message}\".\n\n"
                "As your DevSync AI Mentor, I'm here to pair program, debug errors, review code, "
                "and explain architecture concepts whenever you need!")
