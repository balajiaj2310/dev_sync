/**
 * DevSync AI Assistant & AI Mentor Service
 * Supports text questions and push-to-talk voice recording submissions
 * with multi-turn conversation memory and spoken speech audio.
 */

export const AssistantService = {
  /**
   * Send a text message to the AI Mentor
   */
  async sendMessage(prompt, options = {}) {
    const payload = {
      message: prompt,
      prompt,
      conversationId: options.conversationId || localStorage.getItem('devsync_active_mentor_conv_id') || null,
      repo: options.repo || 'devsync-core',
      branch: options.branch || 'main',
      voiceName: options.voiceName || 'Puck',
      context: options.context || {}
    };

    const token = localStorage.getItem('devsync_auth_token');
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      let response = await fetch('/api/v1/ai/mentor/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok && response.status === 404) {
        // Fallback to legacy path
        response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
      }

      const data = await response.json();
      if (data.conversationId) {
        localStorage.setItem('devsync_active_mentor_conv_id', data.conversationId);
      }

      return {
        ok: data.ok !== false,
        text: data.reply || data.text || 'DevSync AI Mentor responded.',
        reply: data.reply || data.text || 'DevSync AI Mentor responded.',
        audioBase64: data.audioBase64 || null,
        mimeType: data.mimeType || 'audio/wav',
        conversationId: data.conversationId || payload.conversationId,
        source: data.source || 'gemini'
      };
    } catch (err) {
      console.warn('[AssistantService] sendMessage error:', err);
      return {
        ok: false,
        text: `DevSync AI Mentor received your request: "${prompt}". Connected to workspace context.`,
        reply: `DevSync AI Mentor received your request: "${prompt}". Connected to workspace context.`,
        audioBase64: null,
        conversationId: payload.conversationId
      };
    }
  },

  /**
   * Upload recorded audio blob for push-to-talk voice interaction
   */
  async sendVoiceAudio(audioBlob, options = {}) {
    const conversationId = options.conversationId || localStorage.getItem('devsync_active_mentor_conv_id') || null;
    const repo = options.repo || 'devsync-core';
    const branch = options.branch || 'main';
    const voiceName = options.voiceName || 'Puck';

    const token = localStorage.getItem('devsync_auth_token');
    const authHeaders = {};
    if (token) {
      authHeaders['Authorization'] = `Bearer ${token}`;
    }

    // Try FormData upload first
    try {
      const formData = new FormData();
      const ext = audioBlob.type.includes('wav') ? 'wav' : (audioBlob.type.includes('ogg') ? 'ogg' : 'webm');
      formData.append('audio', audioBlob, `voice_recording.${ext}`);
      if (conversationId) formData.append('conversationId', conversationId);
      formData.append('repo', repo);
      formData.append('branch', branch);
      formData.append('voiceName', voiceName);

      const response = await fetch('/api/v1/ai/mentor/voice', {
        method: 'POST',
        headers: authHeaders,
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        if (data.conversationId) {
          localStorage.setItem('devsync_active_mentor_conv_id', data.conversationId);
        }
        return {
          ok: true,
          transcription: data.transcription || 'Spoken inquiry',
          reply: data.reply || 'DevSync AI Mentor responded.',
          audioBase64: data.audioBase64 || null,
          mimeType: data.mimeType || 'audio/wav',
          conversationId: data.conversationId || conversationId,
          source: data.source || 'gemini'
        };
      }
    } catch (err) {
      console.warn('[AssistantService] FormData voice upload failed, trying base64 fallback:', err);
    }

    // Base64 JSON fallback
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64Data = reader.result;
          const res = await fetch('/api/v1/ai/mentor/voice', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...authHeaders
            },
            body: JSON.stringify({
              audioBase64: base64Data,
              mimeType: audioBlob.type || 'audio/webm',
              conversationId,
              repo,
              branch,
              voiceName
            })
          });
          const data = await res.json();
          if (data.conversationId) {
            localStorage.setItem('devsync_active_mentor_conv_id', data.conversationId);
          }
          resolve({
            ok: data.ok !== false,
            transcription: data.transcription || 'Spoken question',
            reply: data.reply || 'DevSync AI Mentor responded.',
            audioBase64: data.audioBase64 || null,
            mimeType: data.mimeType || 'audio/wav',
            conversationId: data.conversationId || conversationId,
            source: data.source || 'gemini'
          });
        } catch (e) {
          resolve({
            ok: false,
            error: 'Failed to communicate with DevSync AI Mentor.'
          });
        }
      };
      reader.readAsDataURL(audioBlob);
    });
  },

  /**
   * Fetch recent conversations
   */
  async listConversations() {
    try {
      const token = localStorage.getItem('devsync_auth_token');
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/v1/ai/mentor/conversations', { headers });
      const data = await res.json();
      return data.conversations || [];
    } catch (e) {
      return [];
    }
  },

  /**
   * Fetch full message history of a conversation
   */
  async getConversation(conversationId) {
    try {
      const token = localStorage.getItem('devsync_auth_token');
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/ai/mentor/conversations/${conversationId}`, { headers });
      const data = await res.json();
      return data.conversation || null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Start a fresh conversation
   */
  async newConversation(options = {}) {
    try {
      const token = localStorage.getItem('devsync_auth_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/v1/ai/mentor/conversations/new', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          repo: options.repo || 'devsync-core',
          branch: options.branch || 'main',
          title: options.title || 'New AI Mentor Session'
        })
      });
      const data = await res.json();
      if (data.conversationId) {
        localStorage.setItem('devsync_active_mentor_conv_id', data.conversationId);
      }
      return data;
    } catch (e) {
      const fallbackId = `conv-${Date.now()}`;
      localStorage.setItem('devsync_active_mentor_conv_id', fallbackId);
      return { conversationId: fallbackId };
    }
  }
};
