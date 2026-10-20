import pytest
from rest_framework.test import APIClient
from apps.accounts.models import User
from apps.chat.models import Conversation, Participant, Message, Reaction, StatusUpdate


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def chat_users(db):
    u1 = User.objects.create(username="naveen3438", email="naveen@devsync.dev")
    u1.set_password("SecurePass123!")
    u1.save()

    u2 = User.objects.create(username="priyas", email="priya@devsync.dev")
    u2.set_password("SecurePass123!")
    u2.save()

    conv = Conversation.objects.create(custom_id="conv-direct-priya", title="Priya S", conv_type="direct")
    Participant.objects.create(conversation=conv, user=u1)
    Participant.objects.create(conversation=conv, user=u2)

    msg = Message.objects.create(
        conversation=conv,
        sender=u2,
        text="Hello from Priya!",
        custom_id="msg-101"
    )

    StatusUpdate.create_status(user=u1, text="Working on Phase 4")
    return u1, u2, conv, msg


@pytest.mark.django_db
class TestChatAPI:
    def test_list_conversations(self, api_client, chat_users):
        u1, _, _, _ = chat_users
        api_client.force_authenticate(user=u1)

        res = api_client.get('/api/v1/chat/conversations/')
        assert res.status_code == 200
        assert isinstance(res.data, list)
        assert len(res.data) >= 1
        assert res.data[0]['id'] == 'conv-direct-priya'

    def test_list_and_post_messages(self, api_client, chat_users):
        u1, _, conv, msg = chat_users
        api_client.force_authenticate(user=u1)

        # List messages
        res = api_client.get(f'/api/v1/chat/conversations/{conv.custom_id}/messages/')
        assert res.status_code == 200
        assert isinstance(res.data, list)
        assert len(res.data) >= 1

        # Post message
        res_post = api_client.post(f'/api/v1/chat/conversations/{conv.custom_id}/messages/', {
            'text': 'Hey Priya, verified the Google OAuth token validation logic!'
        }, format='json')
        assert res_post.status_code == 201
        assert 'id' in res_post.data
        assert res_post.data['text'] == 'Hey Priya, verified the Google OAuth token validation logic!'

    def test_message_reaction(self, api_client, chat_users):
        u1, _, _, msg = chat_users
        api_client.force_authenticate(user=u1)

        res = api_client.post(f'/api/v1/chat/messages/{msg.custom_id}/react/', {
            'emoji': '🚀'
        }, format='json')
        assert res.status_code == 200
        assert res.data['success'] is True
        assert res.data['emoji'] == '🚀'

    def test_statuses_list_and_create(self, api_client, chat_users):
        u1, _, _, _ = chat_users
        api_client.force_authenticate(user=u1)

        # List statuses
        res = api_client.get('/api/v1/chat/statuses/')
        assert res.status_code == 200
        assert isinstance(res.data, list)
        assert len(res.data) >= 1

        # Post status
        res_post = api_client.post('/api/v1/chat/statuses/', {
            'text': '🚀 DevSync Master Upgrade fully operational across frontend and backend!',
            'audience': 'everyone'
        }, format='json')
        assert res_post.status_code == 201
        assert 'id' in res_post.data
        assert res_post.data['text'] == '🚀 DevSync Master Upgrade fully operational across frontend and backend!'


@pytest.mark.django_db
class TestVoiceAIAPI:
    def test_voice_token_endpoint(self, api_client, chat_users, settings):
        settings.GEMINI_API_KEY = 'test-gemini-key'
        api_client.force_authenticate(user=chat_users[0])
        # GET token
        res_get = api_client.get('/api/v1/ai/voice/token')
        assert res_get.status_code == 200
        assert res_get.data['ok'] is True
        assert res_get.data['token'].startswith('auth_tokens/')
        assert res_get.data['model'] == 'gemini-2.0-flash-exp'
        assert 'BidiGenerateContentConstrained' in res_get.data['wsEndpoint']
        assert res_get.data['audioConfig']['inputSampleRate'] == 16000
        assert res_get.data['audioConfig']['outputSampleRate'] == 24000
        assert len(res_get.data['supportedVoices']) >= 5

        # POST token
        res_post = api_client.post('/api/v1/ai/voice/token')
        assert res_post.status_code == 200
        assert res_post.data['token'].startswith('auth_tokens/')

    def test_voice_context_grounding(self, api_client, chat_users, settings):
        settings.GEMINI_API_KEY = 'test-gemini-key'
        api_client.force_authenticate(user=chat_users[0])
        res = api_client.get('/api/v1/ai/voice/context?repo=devsync-core&branch=main')
        assert res.status_code == 200
        assert res.data['ok'] is True
        assert res.data['activeRepo'] == 'devsync-core'
        assert res.data['activeBranch'] == 'main'
        instruction = res.data['systemInstruction']
        assert "DevSync Voice AI Pair Programmer" in instruction
        assert "WORKSPACE REPOSITORIES" in instruction
        assert "OPEN PULL REQUESTS" in instruction
        assert "PROJECT PULSE" in instruction

    def test_ai_text_chat(self, api_client, chat_users, settings):
        settings.GEMINI_API_KEY = 'test-gemini-key'
        api_client.force_authenticate(user=chat_users[0])
        res = api_client.post('/api/ai/chat', {
            'message': 'How do I review a pull request?'
        }, format='json')
        assert res.status_code == 200
        assert 'reply' in res.data
        assert len(res.data['reply']) > 20

    def test_tts_synthesis(self, api_client, chat_users, settings):
        settings.GEMINI_API_KEY = 'test-gemini-key'
        api_client.force_authenticate(user=chat_users[0])
        res = api_client.post('/api/v1/ai/voice/synthesize', {
            'text': 'DevSync pairing active.',
            'voiceName': 'Puck'
        }, format='json')
        assert res.status_code == 200
        assert res.data['ok'] is True
        assert 'audioBase64' in res.data
        assert len(res.data['audioBase64']) > 50
        assert res.data['sampleRate'] == 24000

    def test_assistant_html_page(self, api_client):
        res = api_client.get('/assistant')
        assert res.status_code == 200
        html = res.content.decode('utf-8')
        assert "Voice Assistant" in html
        assert "Google Gemini Live" in html
        assert "voiceOrb" in html
        assert "soundwaveVisualizer" in html
        assert "voiceTranscriptContainer" in html
