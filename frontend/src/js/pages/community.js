/**
 * DevSync Community Page Controller
 */

import { CommunityService } from '../services/community-service.js';

export async function initCommunityPage() {
  const channelListEl = document.getElementById('communityChannelList');
  const chatMessagesEl = document.getElementById('chatMessagesContainer');
  const chatInput = document.getElementById('chatInputField');
  const sendBtn = document.getElementById('chatSendBtn');
  const activeChannelTitle = document.getElementById('activeChannelTitle');
  let currentChannel = 'ch-general';

  async function renderMessages() {
    if (!chatMessagesEl) return;
    const messages = await CommunityService.getMessages(currentChannel);

    chatMessagesEl.innerHTML = messages.map(msg => `
      <div class="chat-message-row">
        <img src="${msg.avatar}" alt="${msg.author}" class="chat-avatar" />
        <div class="chat-msg-body">
          <div class="chat-meta">
            <span class="chat-author">${msg.author}</span>
            <span class="chat-time">${msg.time}</span>
          </div>
          <div class="chat-text">${msg.text}</div>
        </div>
      </div>
    `).join('');

    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }

  // Channel switching
  if (channelListEl) {
    channelListEl.addEventListener('click', (e) => {
      const item = e.target.closest('.channel-item');
      if (!item) return;
      channelListEl.querySelectorAll('.channel-item').forEach(c => c.classList.remove('active'));
      item.classList.add('active');
      currentChannel = item.getAttribute('data-channel-id');
      if (activeChannelTitle) {
        activeChannelTitle.textContent = `#${item.querySelector('span')?.textContent || 'channel'}`;
      }
      renderMessages();
    });
  }

  // Send message
  async function sendMessage() {
    if (!chatInput) return;
    const text = chatInput.value.trim();
    if (!text) return;

    chatInput.value = '';
    await CommunityService.postMessage(currentChannel, text);
    renderMessages();
  }

  if (sendBtn) sendBtn.addEventListener('click', sendMessage);
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
  }

  renderMessages();
}
