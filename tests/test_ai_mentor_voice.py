import pytest
import base64
from rest_framework.test import APIClient
from apps.accounts.models import User
from apps.ai_voice.models import AIMentorConversation, AIMentorMessage


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def test_users(db):
    u1 = User.objects.create(username="mentoruser1", email="mentor1@devsync.dev")
    u1.set_password("SecurePassword123!")
    u1.save()

    u2 = User.objects.create(username="mentoruser2", email="mentor2@devsync.dev")
    u2.set_password("SecurePassword123!")
    u2.save()
    return u1, u2


@pytest.mark.django_db
class TestAIMentorService:
    def test_mentor_chat_and_context_memory(self, api_client, test_users, settings):
        u1, _ = test_users
        api_client.force_authenticate(user=u1)

        # Turn 1: Ask initial question
        res1 = api_client.post('/api/v1/ai/mentor/chat', {
            'message': 'What is Django?',
            'repo': 'devsync-core',
            'branch': 'main'
        }, format='json')

        assert res1.status_code == 200
        assert res1.data['ok'] is True
        assert 'reply' in res1.data
        assert 'conversationId' in res1.data
        conv_id = res1.data['conversationId']

        # Verify conversation was saved in database
        conv = AIMentorConversation.objects.get(id=conv_id)
        assert conv.user == u1
        assert conv.messages.count() == 2

        # Turn 2: Follow-up question referring to 'it'
        res2 = api_client.post('/api/v1/ai/mentor/chat', {
            'message': 'Why do we use it in web development?',
            'conversationId': conv_id
        }, format='json')

        assert res2.status_code == 200
        assert res2.data['ok'] is True
        assert res2.data['conversationId'] == conv_id
        assert conv.messages.count() == 4

    def test_mentor_voice_upload(self, api_client, test_users):
        u1, _ = test_users
        api_client.force_authenticate(user=u1)

        # Generate mock audio payload
        fake_pcm_wav = bytes([128] * 240)
        b64_audio = base64.b64encode(fake_pcm_wav).decode('ascii')

        res = api_client.post('/api/v1/ai/mentor/voice', {
            'audioBase64': f'data:audio/wav;base64,{b64_audio}',
            'repo': 'devsync-core'
        }, format='json')

        assert res.status_code == 200
        assert res.data['ok'] is True
        assert 'reply' in res.data
        assert 'conversationId' in res.data
        assert 'audioBase64' in res.data

    def test_mentor_empty_audio_rejected(self, api_client, test_users):
        u1, _ = test_users
        api_client.force_authenticate(user=u1)

        res = api_client.post('/api/v1/ai/mentor/voice', {}, format='json')
        assert res.status_code == 400
        assert res.data['ok'] is False
        assert res.data['code'] == 'MISSING_AUDIO_FILE'

    def test_conversations_privacy_isolation(self, api_client, test_users):
        u1, u2 = test_users

        # User 1 creates conversation
        api_client.force_authenticate(user=u1)
        res_new = api_client.post('/api/v1/ai/mentor/conversations/new', {
            'title': 'User 1 Private Architecture Review'
        }, format='json')
        assert res_new.status_code == 201
        conv_id = res_new.data['conversationId']

        # User 2 tries to access User 1 conversation
        api_client.force_authenticate(user=u2)
        res_forbidden = api_client.get(f'/api/v1/ai/mentor/conversations/{conv_id}')
        assert res_forbidden.status_code == 403
        assert res_forbidden.data['ok'] is False

        # User 1 can access it
        api_client.force_authenticate(user=u1)
        res_owner = api_client.get(f'/api/v1/ai/mentor/conversations/{conv_id}')
        assert res_owner.status_code == 200
        assert res_owner.data['ok'] is True
        assert res_owner.data['conversation']['title'] == 'User 1 Private Architecture Review'
