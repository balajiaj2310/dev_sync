/**
 * DevSync AI Assistant & Voice Studio Controller
 * Coordinates real-time voice-to-voice streaming with Google Gemini Live,
 * animated reactive Voice Orb, transcription, context synchronization,
 * and text chat pairing.
 */

import { DevSyncVoiceService } from '../services/voice-service.js';
import { AssistantService } from '../services/assistant-service.js';
import { toastSuccess, toastError, toastInfo } from '../components/toast.js';

export function initAssistantPage() {
  console.log('[DevSync AI Mentor] Initializing Voice & Developer Assistant Studio...');

  // State
  let voiceService = null;
  let activeRepo = 'devsync-core';
  let activeBranch = 'main';
  let selectedVoice = 'Puck';
  let isRecording = false;
  let currentConversationId = localStorage.getItem('devsync_active_mentor_conv_id') || null;

  // 1. Tab Switching: AI Mentor Studio <-> Chat View
  const tabVoiceBtn = document.getElementById('tabVoiceBtn');
  const tabChatBtn = document.getElementById('tabChatBtn');
  const paneVoice = document.getElementById('paneVoice');
  const paneChat = document.getElementById('paneChat');

  function switchTab(target) {
    if (target === 'voice') {
      tabVoiceBtn?.classList.add('active');
      tabChatBtn?.classList.remove('active');
      paneVoice?.classList.add('active');
      paneChat?.classList.remove('active');
    } else {
      tabChatBtn?.classList.add('active');
      tabVoiceBtn?.classList.remove('active');
      paneChat?.classList.add('active');
      paneVoice?.classList.remove('active');
    }
  }

  tabVoiceBtn?.addEventListener('click', () => switchTab('voice'));
  tabChatBtn?.addEventListener('click', () => switchTab('chat'));

  // 2. DOM Elements
  const voiceOrb = document.getElementById('voiceOrb');
  const voiceOrbWrapper = document.getElementById('voiceOrbWrapper');
  const btnPushToTalk = document.getElementById('btnPushToTalk');
  const btnPushToTalkText = document.getElementById('btnPushToTalkText');
  const voiceStatusPill = document.getElementById('voiceStatusPill');
  const voiceStatusText = document.getElementById('voiceStatusText');
  const voiceSessionTimer = document.getElementById('voiceSessionTimer');
  const mentorWelcomeMessage = document.getElementById('mentorWelcomeMessage');
  const mentorErrorBox = document.getElementById('mentorErrorBox');
  const mentorErrorText = document.getElementById('mentorErrorText');
  const mentorRetryBtn = document.getElementById('mentorRetryBtn');
  const mentorAudioController = document.getElementById('mentorAudioController');
  const mentorAudioStatus = document.getElementById('mentorAudioStatus');
  const btnPauseResumeSpeech = document.getElementById('btnPauseResumeSpeech');
  const btnReplaySpeech = document.getElementById('btnReplaySpeech');
  const btnStopSpeech = document.getElementById('btnStopSpeech');
  const voiceTranscriptContainer = document.getElementById('voiceTranscriptContainer');
  const transcriptEmptyState = document.getElementById('transcriptEmptyState');
  const soundwaveBars = document.querySelectorAll('.soundwave-bar');
  const voiceRepoSelect = document.getElementById('voiceRepoSelect');
  const voiceBranchSelect = document.getElementById('voiceBranchSelect');
  const voicePersonaSelect = document.getElementById('voicePersonaSelect');
  const topActiveContextBadge = document.getElementById('topActiveContextBadge');
  const btnRefreshContext = document.getElementById('btnRefreshContext');
  const btnCopyTranscript = document.getElementById('btnCopyTranscript');
  const btnClearTranscript = document.getElementById('btnClearTranscript');
  const btnNewChatFromTranscript = document.getElementById('btnNewChatFromTranscript');
  const btnNewSession = document.getElementById('btnNewSession');
  const recentSessionsList = document.getElementById('recentSessionsList');
  const quickCmdBtns = document.querySelectorAll('.quick-cmd-btn');

  // Text Chat Tab Elements
  const messagesContainer = document.getElementById('assistantMessages');
  const chatInput = document.getElementById('assistantInput');
  const sendBtn = document.getElementById('assistantSendBtn');
  const newChatBtn = document.getElementById('btnNewChat');
  const promptChips = document.querySelectorAll('.prompt-chip');
  const chatHistoryList = document.getElementById('chatHistoryList');

  // Helper: HTML Escaper
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Update Workspace Context
  function updateContextUI() {
    activeRepo = voiceRepoSelect?.value || 'devsync-core';
    activeBranch = voiceBranchSelect?.value || 'main';
    if (topActiveContextBadge) {
      topActiveContextBadge.textContent = `Context: ${activeRepo} (${activeBranch})`;
    }
    if (voiceService) {
      voiceService.options.activeRepo = activeRepo;
      voiceService.options.activeBranch = activeBranch;
    }
  }

  voiceRepoSelect?.addEventListener('change', updateContextUI);
  voiceBranchSelect?.addEventListener('change', updateContextUI);
  voicePersonaSelect?.addEventListener('change', (e) => {
    selectedVoice = e.target.value;
    if (voiceService) {
      voiceService.options.voiceName = selectedVoice;
    }
    toastInfo(`Voice persona set to ${selectedVoice}.`);
  });

  btnRefreshContext?.addEventListener('click', async () => {
    btnRefreshContext.classList.add('btn-loading');
    try {
      const res = await fetch(`/api/v1/ai/voice/context?repo=${activeRepo}&branch=${activeBranch}`);
      const data = await res.json();
      if (data.ok) {
        toastSuccess('Workspace context refreshed.');
      }
    } catch (e) {
      toastError('Failed to refresh context.');
    } finally {
      btnRefreshContext.classList.remove('btn-loading');
    }
  });

  // Soundwave and Orb updates
  function updateVisualizer(level) {
    if (!voiceOrb) return;
    const scale = 1 + (level * 0.35);
    voiceOrb.style.setProperty('--orb-scale', scale.toFixed(3));

    soundwaveBars.forEach((bar, i) => {
      const factor = Math.sin((i / soundwaveBars.length) * Math.PI);
      const height = Math.max(6, Math.min(28, (level * 36 * factor) + (Math.random() * 4)));
      bar.style.height = `${height}px`;
    });
  }

  // Visual State Manager (IDLE, LISTENING, PROCESSING/THINKING, SPEAKING, ERROR)
  function handleStateChange(state, detail) {
    console.log('[DevSync AI Mentor State]:', state, detail);

    voiceOrb?.classList.remove('state-idle', 'state-listening', 'state-thinking', 'state-speaking', 'state-error');
    voiceStatusPill?.classList.remove('status-connected', 'status-speaking', 'status-error');
    mentorErrorBox?.classList.add('d-none');

    switch (state) {
      case 'idle':
      case 'ended':
        isRecording = false;
        voiceOrb?.classList.add('state-idle');
        voiceOrbWrapper?.classList.remove('is-listening');
        btnPushToTalk?.classList.remove('is-recording');
        if (btnPushToTalkText) btnPushToTalkText.textContent = 'Tap to Speak';
        if (voiceStatusText) voiceStatusText.textContent = "Hey! I'm your DevSync AI Mentor.";
        if (mentorWelcomeMessage) mentorWelcomeMessage.textContent = 'Tap the microphone to speak, or type your question below.';
        mentorAudioController?.classList.add('d-none');
        updateVisualizer(0);
        break;

      case 'requesting_mic':
        voiceOrb?.classList.add('state-thinking');
        if (voiceStatusText) voiceStatusText.textContent = 'Requesting Microphone Permission...';
        break;

      case 'listening':
        isRecording = true;
        voiceOrb?.classList.add('state-listening');
        voiceOrbWrapper?.classList.add('is-listening');
        voiceStatusPill?.classList.add('status-connected');
        btnPushToTalk?.classList.add('is-recording');
        if (btnPushToTalkText) btnPushToTalkText.textContent = 'Stop Recording';
        if (voiceStatusText) voiceStatusText.textContent = 'Listening...';
        if (mentorWelcomeMessage) mentorWelcomeMessage.textContent = 'Speaking now... Click again when finished.';
        mentorAudioController?.classList.add('d-none');
        break;

      case 'thinking':
        isRecording = false;
        voiceOrb?.classList.add('state-thinking');
        voiceOrbWrapper?.classList.remove('is-listening');
        btnPushToTalk?.classList.remove('is-recording');
        if (btnPushToTalkText) btnPushToTalkText.textContent = 'Thinking...';
        if (voiceStatusText) voiceStatusText.textContent = 'Thinking...';
        if (mentorWelcomeMessage) mentorWelcomeMessage.textContent = 'Analyzing question and formulating mentor solution...';
        mentorAudioController?.classList.add('d-none');
        updateVisualizer(0);
        break;

      case 'speaking':
        isRecording = false;
        voiceOrb?.classList.add('state-speaking');
        voiceOrbWrapper?.classList.remove('is-listening');
        voiceStatusPill?.classList.add('status-speaking');
        btnPushToTalk?.classList.remove('is-recording');
        if (btnPushToTalkText) btnPushToTalkText.textContent = 'Tap to Speak';
        if (voiceStatusText) voiceStatusText.textContent = 'Speaking Answer...';
        if (mentorWelcomeMessage) mentorWelcomeMessage.textContent = 'AI Mentor is speaking aloud. You can pause or stop below.';
        mentorAudioController?.classList.remove('d-none');
        if (mentorAudioStatus) mentorAudioStatus.textContent = 'Speaking answer...';
        break;

      case 'paused':
        if (mentorAudioStatus) mentorAudioStatus.textContent = 'Speech paused.';
        break;

      case 'error':
        isRecording = false;
        voiceOrb?.classList.add('state-idle');
        voiceOrbWrapper?.classList.remove('is-listening');
        voiceStatusPill?.classList.add('status-error');
        btnPushToTalk?.classList.remove('is-recording');
        if (btnPushToTalkText) btnPushToTalkText.textContent = 'Tap to Speak';
        if (voiceStatusText) voiceStatusText.textContent = 'Connection or Microphone Notice';
        if (mentorErrorBox) {
          mentorErrorBox.classList.remove('d-none');
          if (mentorErrorText) mentorErrorText.textContent = detail || 'An error occurred. Please try again.';
        }
        mentorAudioController?.classList.add('d-none');
        updateVisualizer(0);
        break;
    }
  }

  // Audio Playback Controller Buttons
  btnPauseResumeSpeech?.addEventListener('click', () => {
    if (!voiceService) return;
    if (voiceService.state === 'speaking') {
      voiceService.pauseSpeech();
    } else {
      voiceService.resumeSpeech();
    }
  });

  btnReplaySpeech?.addEventListener('click', () => {
    if (voiceService) {
      voiceService.replayLastSpeech();
    }
  });

  btnStopSpeech?.addEventListener('click', () => {
    if (voiceService) {
      voiceService.stopAudioPlayback();
      toastInfo('Speech playback stopped.');
    }
  });

  mentorRetryBtn?.addEventListener('click', () => {
    mentorErrorBox?.classList.add('d-none');
    handleStateChange('idle');
  });

  // Append Message to Unified Transcript
  function appendTranscript(speaker, text, isFinal = true, audioBase64 = null) {
    if (!voiceTranscriptContainer || !text) return;

    if (transcriptEmptyState && transcriptEmptyState.parentElement) {
      transcriptEmptyState.remove();
    }

    const msg = document.createElement('div');
    msg.className = `transcript-message speaker-${speaker}`;

    let audioActionHtml = '';
    if (speaker === 'ai' && audioBase64) {
      audioActionHtml = `
        <div class="msg-audio-actions">
          <button class="msg-replay-btn" data-audio="${audioBase64}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            <span>Play Audio</span>
          </button>
          <button class="msg-copy-btn" title="Copy response">Copy</button>
        </div>
      `;
    }

    msg.innerHTML = `
      <span class="transcript-speaker-tag">${speaker === 'user' ? 'You' : 'DevSync AI Mentor'}</span>
      <div style="white-space: pre-wrap; line-height: 1.55;">${escapeHtml(text)}</div>
      ${audioActionHtml}
    `;

    const replayBtn = msg.querySelector('.msg-replay-btn');
    if (replayBtn) {
      replayBtn.addEventListener('click', () => {
        const b64 = replayBtn.getAttribute('data-audio');
        if (voiceService && b64) {
          voiceService.playSpeechAudio(b64, 'audio/wav');
        }
      });
    }

    const copyBtn = msg.querySelector('.msg-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(text);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => copyBtn.textContent = 'Copy', 1500);
      });
    }

    voiceTranscriptContainer.appendChild(msg);
    voiceTranscriptContainer.scrollTop = voiceTranscriptContainer.scrollHeight;

    // Synchronize into Chat View tab as well
    if (messagesContainer) {
      const bubble = document.createElement('div');
      bubble.className = speaker === 'user' ? 'assistant-bubble-user' : 'assistant-bubble-ai';
      bubble.innerHTML = `<div style="white-space: pre-wrap;">${escapeHtml(text)}</div>`;
      messagesContainer.appendChild(bubble);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  // Initialize Voice Service Instance
  function getVoiceService() {
    if (!voiceService) {
      voiceService = new DevSyncVoiceService({
        activeRepo,
        activeBranch,
        voiceName: selectedVoice,
        onStateChange: handleStateChange,
        onAudioLevel: updateVisualizer,
        onTranscript: appendTranscript,
        onError: (err) => {
          handleStateChange('error', err);
        },
        onTimerTick: (timeStr) => {
          if (voiceSessionTimer) voiceSessionTimer.textContent = timeStr;
        }
      });
    }
    return voiceService;
  }

  // Push-to-Talk Toggle Interaction
  async function togglePushToTalk() {
    const service = getVoiceService();
    if (isRecording) {
      // User tapped to finish speaking
      await service.stopRecording();
    } else {
      // User tapped to start speaking
      await service.startRecording();
    }
  }

  btnPushToTalk?.addEventListener('click', togglePushToTalk);
  voiceOrb?.addEventListener('click', togglePushToTalk);

  // Transcript Bar: Text Question Submission
  const voiceTranscriptForm = document.getElementById('voiceTranscriptForm');
  const voiceTranscriptInput = document.getElementById('voiceTranscriptInput');
  const btnVoiceTranscriptSend = document.getElementById('btnVoiceTranscriptSend');

  async function handleTranscriptTextSubmit(e) {
    if (e) e.preventDefault();
    const text = voiceTranscriptInput?.value?.trim();
    if (!text) return;

    voiceTranscriptInput.value = '';
    appendTranscript('user', text, true);

    const service = getVoiceService();
    if (btnVoiceTranscriptSend) {
      btnVoiceTranscriptSend.disabled = true;
      btnVoiceTranscriptSend.innerHTML = '<span class="btn-spinner"></span>';
    }

    try {
      await service.sendSpokenCommand(text);
    } catch (err) {
      toastError('Failed to communicate with DevSync AI Mentor.');
    } finally {
      if (btnVoiceTranscriptSend) {
        btnVoiceTranscriptSend.disabled = false;
        btnVoiceTranscriptSend.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          <span>Send</span>
        `;
      }
      voiceTranscriptInput?.focus();
    }
  }

  voiceTranscriptForm?.addEventListener('submit', handleTranscriptTextSubmit);

  // Quick Mentor Questions
  quickCmdBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const command = btn.getAttribute('data-command') || btn.innerText.trim();
      appendTranscript('user', command, true);
      const service = getVoiceService();
      await service.sendSpokenCommand(command);
    });
  });

  // Transcript Tools (Copy & Clear)
  btnCopyTranscript?.addEventListener('click', () => {
    const messages = voiceTranscriptContainer?.querySelectorAll('.transcript-message');
    if (!messages || messages.length === 0) {
      toastInfo('No transcript messages to copy.');
      return;
    }
    let fullText = '';
    messages.forEach(m => {
      const speaker = m.querySelector('.transcript-speaker-tag')?.textContent || '';
      const text = m.innerText.replace(speaker, '').trim();
      fullText += `${speaker}: ${text}\n\n`;
    });
    navigator.clipboard.writeText(fullText.trim());
    toastSuccess('Transcript copied to clipboard.');
  });

  btnClearTranscript?.addEventListener('click', () => {
    if (voiceTranscriptContainer) {
      voiceTranscriptContainer.innerHTML = `
        <div class="transcript-empty-state" id="transcriptEmptyState">
          <div>Hey! I'm your DevSync AI Mentor.<br/>Tap the mic to speak or type a question below to begin!</div>
        </div>
      `;
      toastInfo('Transcript cleared.');
    }
  });

  // Start New Conversation
  async function startNewConversation() {
    if (voiceService) {
      voiceService.stopAudioPlayback();
    }
    const res = await AssistantService.newConversation({
      repo: activeRepo,
      branch: activeBranch,
      title: 'New AI Mentor Session'
    });
    currentConversationId = res.conversationId;
    btnClearTranscript?.click();
    if (messagesContainer) {
      messagesContainer.innerHTML = `
        <div class="assistant-bubble-ai">
          <strong>Hey! I'm your DevSync AI Mentor.</strong> Ask me anything about programming, Django, JavaScript, code reviews, or software architecture.
        </div>
      `;
    }
    loadRecentConversations();
    toastSuccess('New conversation started.');
  }

  btnNewSession?.addEventListener('click', startNewConversation);
  btnNewChatFromTranscript?.addEventListener('click', startNewConversation);
  newChatBtn?.addEventListener('click', startNewConversation);

  // Load Recent Conversations
  async function loadRecentConversations() {
    try {
      const convs = await AssistantService.listConversations();
      if (!recentSessionsList) return;

      if (!convs || convs.length === 0) {
        recentSessionsList.innerHTML = `<div style="font-size: 12px; color: var(--color-text-secondary); padding: 4px 0;">No prior sessions</div>`;
        return;
      }

      recentSessionsList.innerHTML = '';
      if (chatHistoryList) chatHistoryList.innerHTML = '';

      convs.forEach(c => {
        const item = document.createElement('button');
        item.className = `btn btn-ghost btn-sm text-left w-100 ${c.id === currentConversationId ? 'active' : ''}`;
        item.style.fontSize = '12px';
        item.style.whiteSpace = 'nowrap';
        item.style.overflow = 'hidden';
        item.style.textOverflow = 'ellipsis';
        item.textContent = c.title || 'Session';
        item.title = c.title;

        item.addEventListener('click', async () => {
          currentConversationId = c.id;
          localStorage.setItem('devsync_active_mentor_conv_id', c.id);
          await loadConversationHistory(c.id);
          loadRecentConversations();
        });

        recentSessionsList.appendChild(item);

        if (chatHistoryList) {
          const chatItem = item.cloneNode(true);
          chatItem.addEventListener('click', async () => {
            currentConversationId = c.id;
            localStorage.setItem('devsync_active_mentor_conv_id', c.id);
            await loadConversationHistory(c.id);
            loadRecentConversations();
          });
          chatHistoryList.appendChild(chatItem);
        }
      });
    } catch (e) {
      console.warn('Error loading conversations:', e);
    }
  }

  async function loadConversationHistory(convId) {
    try {
      const data = await AssistantService.getConversation(convId);
      if (!data || !data.messages) return;

      if (voiceTranscriptContainer) voiceTranscriptContainer.innerHTML = '';
      if (messagesContainer) messagesContainer.innerHTML = '';

      data.messages.forEach(m => {
        appendTranscript(m.role === 'user' ? 'user' : 'ai', m.content, true, m.audioBase64);
      });
      toastSuccess(`Loaded "${data.title || 'Session'}"`);
    } catch (e) {
      console.warn('Error loading conversation history:', e);
    }
  }

  // 3. AI Text Chat Tab Event Listeners
  async function handleTextSend(text) {
    if (!text) return;
    appendTranscript('user', text, true);
    const service = getVoiceService();
    await service.sendSpokenCommand(text);
  }

  sendBtn?.addEventListener('click', () => {
    const val = chatInput?.value?.trim();
    if (val) {
      chatInput.value = '';
      handleTextSend(val);
    }
  });

  chatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = chatInput?.value?.trim();
      if (val) {
        chatInput.value = '';
        handleTextSend(val);
      }
    }
  });

  promptChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt') || chip.textContent.trim();
      handleTextSend(prompt);
    });
  });

  // Load existing history and conversations on boot
  loadRecentConversations();
  if (currentConversationId) {
    loadConversationHistory(currentConversationId);
  }
}
