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
  console.log('[DevSync AI] Initializing Voice & Coding Studio...');

  // State
  let voiceService = null;
  let activeRepo = 'devsync-core';
  let activeBranch = 'main';
  let selectedVoice = 'Puck';
  let selectedLanguage = 'en-US';

  // 1. Tab Switching: Voice Studio <-> AI Chat
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

  // 2. Voice Studio Elements
  const voiceOrb = document.getElementById('voiceOrb');
  const voiceOrbWrapper = document.getElementById('voiceOrbWrapper');
  const btnVoiceAction = document.getElementById('btnVoiceAction');
  const btnVoiceActionText = document.getElementById('btnVoiceActionText');
  const btnToggleMute = document.getElementById('btnToggleMute');
  const btnEndSession = document.getElementById('btnEndSession');
  const voiceStatusPill = document.getElementById('voiceStatusPill');
  const voiceStatusText = document.getElementById('voiceStatusText');
  const voiceSessionTimer = document.getElementById('voiceSessionTimer');
  const voiceTranscriptContainer = document.getElementById('voiceTranscriptContainer');
  const transcriptEmptyState = document.getElementById('transcriptEmptyState');
  const soundwaveBars = document.querySelectorAll('.soundwave-bar');
  const voiceRepoSelect = document.getElementById('voiceRepoSelect');
  const voiceBranchSelect = document.getElementById('voiceBranchSelect');
  const voicePersonaSelect = document.getElementById('voicePersonaSelect');
  const voiceLangSelect = document.getElementById('voiceLangSelect');
  const topActiveContextBadge = document.getElementById('topActiveContextBadge');
  const btnRefreshContext = document.getElementById('btnRefreshContext');
  const btnCopyTranscript = document.getElementById('btnCopyTranscript');
  const btnClearTranscript = document.getElementById('btnClearTranscript');
  const quickCmdBtns = document.querySelectorAll('.quick-cmd-btn');

  // Context Selectors
  function updateContextUI() {
    activeRepo = voiceRepoSelect?.value || 'devsync-core';
    activeBranch = voiceBranchSelect?.value || 'main';
    if (topActiveContextBadge) {
      topActiveContextBadge.textContent = `Context: ${activeRepo} (${activeBranch})`;
    }
  }

  voiceRepoSelect?.addEventListener('change', updateContextUI);
  voiceBranchSelect?.addEventListener('change', updateContextUI);
  voicePersonaSelect?.addEventListener('change', (e) => {
    selectedVoice = e.target.value;
    toastInfo(`Voice persona changed to ${selectedVoice}.`);
  });
  voiceLangSelect?.addEventListener('change', (e) => {
    selectedLanguage = e.target.value;
  });

  btnRefreshContext?.addEventListener('click', async () => {
    btnRefreshContext.classList.add('btn-loading');
    try {
      const res = await fetch(`/api/v1/ai/voice/context?repo=${activeRepo}&branch=${activeBranch}`);
      const data = await res.json();
      if (data.ok) {
        toastSuccess('DevSync context refreshed.');
      }
    } catch (e) {
      toastError('Failed to refresh context.');
    } finally {
      btnRefreshContext.classList.remove('btn-loading');
    }
  });

  // Transcript Rendering
  function appendTranscript(speaker, text, isFinal = true) {
    if (!voiceTranscriptContainer || !text) return;

    if (transcriptEmptyState && transcriptEmptyState.parentElement) {
      transcriptEmptyState.remove();
    }

    const msg = document.createElement('div');
    msg.className = `transcript-message speaker-${speaker}`;
    msg.innerHTML = `
      <span class="transcript-speaker-tag">${speaker === 'user' ? 'You' : 'DevSync AI'}</span>
      <div style="white-space: pre-wrap;">${escapeHtml(text)}</div>
    `;

    voiceTranscriptContainer.appendChild(msg);
    voiceTranscriptContainer.scrollTop = voiceTranscriptContainer.scrollHeight;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

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
          <div>Transcript cleared. Start speaking to record.</div>
        </div>
      `;
      toastInfo('Transcript cleared.');
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

  // Voice State Transitions
  function handleVoiceStateChange(state, detail) {
    console.log('[DevSync Voice State]:', state, detail);

    // Reset orb classes
    voiceOrb?.classList.remove('state-idle', 'state-connecting', 'state-listening', 'state-thinking', 'state-speaking', 'state-muted', 'state-interrupted');
    voiceStatusPill?.classList.remove('status-connected', 'status-speaking', 'status-muted', 'status-error');

    switch (state) {
      case 'idle':
      case 'ended':
        voiceOrb?.classList.add('state-idle');
        voiceOrbWrapper?.classList.remove('is-listening');
        if (voiceStatusText) voiceStatusText.textContent = 'Ready to Connect';
        if (btnVoiceActionText) btnVoiceActionText.textContent = 'Start Voice Assistant';
        btnVoiceAction?.classList.remove('active');
        if (btnToggleMute) btnToggleMute.disabled = true;
        if (btnEndSession) btnEndSession.disabled = true;
        updateVisualizer(0);
        break;

      case 'requesting_mic':
        voiceOrb?.classList.add('state-connecting');
        if (voiceStatusText) voiceStatusText.textContent = 'Requesting Microphone...';
        break;

      case 'connecting':
        voiceOrb?.classList.add('state-connecting');
        if (voiceStatusText) voiceStatusText.textContent = 'Connecting to Gemini Live...';
        break;

      case 'listening':
        voiceOrb?.classList.add('state-listening');
        voiceOrbWrapper?.classList.add('is-listening');
        voiceStatusPill?.classList.add('status-connected');
        if (voiceStatusText) voiceStatusText.textContent = detail || 'Listening to your voice...';
        if (btnVoiceActionText) btnVoiceActionText.textContent = 'Voice Assistant Active';
        btnVoiceAction?.classList.add('active');
        if (btnToggleMute) btnToggleMute.disabled = false;
        if (btnEndSession) btnEndSession.disabled = false;
        break;

      case 'thinking':
        voiceOrb?.classList.add('state-thinking');
        voiceOrbWrapper?.classList.remove('is-listening');
        if (voiceStatusText) voiceStatusText.textContent = 'DevSync AI is thinking...';
        break;

      case 'speaking':
        voiceOrb?.classList.add('state-speaking');
        voiceOrbWrapper?.classList.remove('is-listening');
        voiceStatusPill?.classList.add('status-speaking');
        if (voiceStatusText) voiceStatusText.textContent = 'DevSync AI Speaking...';
        break;

      case 'muted':
        voiceOrb?.classList.add('state-muted');
        voiceOrbWrapper?.classList.remove('is-listening');
        voiceStatusPill?.classList.add('status-muted');
        if (voiceStatusText) voiceStatusText.textContent = 'Microphone Muted';
        btnToggleMute?.classList.add('active');
        break;

      case 'interrupted':
        voiceOrb?.classList.add('state-interrupted');
        voiceOrbWrapper?.classList.remove('is-listening');
        if (voiceStatusText) voiceStatusText.textContent = 'Interrupted (Barge-in)';
        break;

      case 'error':
        voiceStatusPill?.classList.add('status-error');
        if (voiceStatusText) voiceStatusText.textContent = detail || 'Connection Error';
        break;
    }
  }

  // Start / Stop Session Handler
  async function toggleVoiceSession() {
    if (voiceService && (voiceService.state === 'listening' || voiceService.state === 'speaking' || voiceService.state === 'connecting')) {
      voiceService.stopSession();
      toastInfo('Voice session ended.');
      return;
    }

    voiceService = new DevSyncVoiceService({
      activeRepo,
      activeBranch,
      voiceName: selectedVoice,
      language: selectedLanguage,
      onStateChange: handleVoiceStateChange,
      onAudioLevel: updateVisualizer,
      onTranscript: appendTranscript,
      onError: (err) => toastError(err),
      onTimerTick: (timeStr) => {
        if (voiceSessionTimer) voiceSessionTimer.textContent = timeStr;
      }
    });

    await voiceService.startSession();
  }

  btnVoiceAction?.addEventListener('click', toggleVoiceSession);
  voiceOrb?.addEventListener('click', toggleVoiceSession);

  btnToggleMute?.addEventListener('click', () => {
    if (!voiceService) return;
    const newMute = !voiceService.isMuted;
    voiceService.setMute(newMute);
    btnToggleMute.classList.toggle('active', newMute);
    toastInfo(newMute ? 'Microphone muted.' : 'Microphone unmuted.');
  });

  btnEndSession?.addEventListener('click', () => {
    if (voiceService) {
      voiceService.stopSession();
      toastInfo('Voice session ended.');
    }
  });

  // Quick Voice Commands
  quickCmdBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const command = btn.getAttribute('data-command') || btn.innerText.trim();
      appendTranscript('user', command, true);

      if (!voiceService || voiceService.state === 'idle' || voiceService.state === 'ended') {
        // Initialize voice service in fallback / command execution mode
        voiceService = new DevSyncVoiceService({
          activeRepo,
          activeBranch,
          voiceName: selectedVoice,
          language: selectedLanguage,
          onStateChange: handleVoiceStateChange,
          onAudioLevel: updateVisualizer,
          onTranscript: appendTranscript,
          onError: (err) => toastError(err),
          onTimerTick: (timeStr) => {
            if (voiceSessionTimer) voiceSessionTimer.textContent = timeStr;
          }
        });
      }

      await voiceService.sendSpokenCommand(command);
    });
  });

  // =========================================================================
  // 3. AI TEXT CHAT TAB LOGIC (Preserved & Enhanced)
  // =========================================================================
  const messagesContainer = document.getElementById('assistantMessages');
  const chatInput = document.getElementById('assistantInput');
  const sendBtn = document.getElementById('assistantSendBtn');
  const newChatBtn = document.getElementById('btnNewChat');
  const promptChips = document.querySelectorAll('.prompt-chip');

  async function handleTextSend(text) {
    if (!text || !messagesContainer) return;

    // Append User Message
    const userBubble = document.createElement('div');
    userBubble.className = 'assistant-bubble-user';
    userBubble.textContent = text;
    messagesContainer.appendChild(userBubble);

    // Append Loading Indicator
    const loadingBubble = document.createElement('div');
    loadingBubble.className = 'assistant-bubble-ai';
    loadingBubble.innerHTML = `<span class="btn-spinner"></span> DevSync AI is thinking...`;
    messagesContainer.appendChild(loadingBubble);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
      const res = await AssistantService.sendMessage(text, { repo: activeRepo, branch: activeBranch });
      loadingBubble.innerHTML = `
        <div style="white-space: pre-wrap;">${escapeHtml(res.reply || res.text || 'DevSync AI responded.')}</div>
        ${res.code ? `
          <div class="ai-code-block">
            <button class="ai-code-copy-btn">Copy</button>
            <code>${escapeHtml(res.code)}</code>
          </div>
        ` : ''}
      `;

      const copyBtn = loadingBubble.querySelector('.ai-code-copy-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(res.code);
          copyBtn.textContent = 'Copied!';
          toastSuccess('Code copied to clipboard.');
          setTimeout(() => copyBtn.textContent = 'Copy', 1500);
        });
      }
    } catch (e) {
      loadingBubble.innerHTML = `<div>DevSync AI Assistant is currently processing. Please try again.</div>`;
    }

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
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

  newChatBtn?.addEventListener('click', () => {
    if (messagesContainer) {
      messagesContainer.innerHTML = `
        <div class="assistant-bubble-ai">
          <strong>DevSync AI Coding Assistant</strong><br />
          Ask me anything about your repositories, code reviews, debugging, or database schemas.
        </div>
      `;
      toastSuccess('Conversation reset.');
    }
  });
}
