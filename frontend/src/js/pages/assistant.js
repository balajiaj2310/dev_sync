/**
 * DevSync AI Assistant Controller
 */

import { AssistantService } from '../services/assistant-service.js';
import { toastSuccess } from '../components/toast.js';

export function initAssistantPage() {
  const messagesContainer = document.getElementById('assistantMessages');
  const chatInput = document.getElementById('assistantInput');
  const sendBtn = document.getElementById('assistantSendBtn');
  const newChatBtn = document.getElementById('btnNewChat');
  const promptChips = document.querySelectorAll('.prompt-chip');

  async function handleSend(text) {
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

    const res = await AssistantService.sendMessage(text);

    loadingBubble.innerHTML = `
      <div style="white-space: pre-wrap;">${res.text}</div>
      ${res.code ? `
        <div class="ai-code-block">
          <button class="ai-code-copy-btn">Copy</button>
          <code>${res.code}</code>
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

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  if (sendBtn && chatInput) {
    sendBtn.addEventListener('click', () => {
      const val = chatInput.value.trim();
      if (val) {
        chatInput.value = '';
        handleSend(val);
      }
    });

    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = chatInput.value.trim();
        if (val) {
          chatInput.value = '';
          handleSend(val);
        }
      }
    });
  }

  // Suggestion chips
  promptChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt') || chip.textContent.trim();
      handleSend(prompt);
    });
  });

  if (newChatBtn && messagesContainer) {
    newChatBtn.addEventListener('click', () => {
      messagesContainer.innerHTML = `
        <div class="assistant-bubble-ai">
          <strong>DevSync AI Coding Assistant</strong><br />
          Ask me anything about your repositories, code reviews, debugging, or database schemas.
        </div>
      `;
      toastSuccess('Conversation reset.');
    });
  }
}
