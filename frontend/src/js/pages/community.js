/**
 * DevSync Discussions & Chat Controller
 * WhatsApp-inspired developer messaging workspace with Realtime Polling,
 * 1:1 DMs, Project Squad Groups, 24h Statuses, Code Snippets, Replies, and Emoji Reactions
 */

import { CommunityService } from '../services/community-service.js';
import { AuthService } from '../services/auth-service.js';
import { toastSuccess, toastDanger, toastInfo } from '../components/toast.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatMessageText(text) {
  if (!text) return '';
  // 1. Triple backticks code blocks
  if (text.includes('```')) {
    const parts = text.split('```');
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return `<pre class="chat-code-block"><code>${escapeHtml(part.trim())}</code></pre>`;
      }
      return formatInlineCode(escapeHtml(part));
    }).join('');
  }
  return formatInlineCode(escapeHtml(text));
}

function formatInlineCode(html) {
  return html.replace(/`([^`]+)`/g, '<code style="background: rgba(0,0,0,0.06); padding: 1px 4px; border-radius: 4px; font-family: monospace; font-size: 12px;">$1</code>');
}

export async function initCommunityPage() {
  const layout = document.getElementById('chatWorkspaceLayout');
  if (!layout) return;

  // DOM Elements
  const statusStrip = document.getElementById('chatStatusStrip');
  const convListEl = document.getElementById('chatConversationsList');
  const searchInput = document.getElementById('chatSearchInput');
  const filterTabs = document.querySelectorAll('.chat-filter-btn');

  const activeChatAvatar = document.getElementById('activeChatAvatar');
  const activeChatTitle = document.getElementById('activeChatTitle');
  const activeChatSubtitle = document.getElementById('activeChatSubtitle');
  const messagesContainer = document.getElementById('chatMessagesContainer');

  const replyPreviewBar = document.getElementById('replyPreviewBar');
  const replyPreviewSender = document.getElementById('replyPreviewSender');
  const replyPreviewText = document.getElementById('replyPreviewText');
  const btnCancelReply = document.getElementById('btnCancelReply');

  const emojiPopover = document.getElementById('emojiPopover');
  const btnToggleEmoji = document.getElementById('btnToggleEmoji');
  const chatInput = document.getElementById('chatInputField');
  const sendBtn = document.getElementById('chatSendBtn');

  const infoPanel = document.getElementById('chatInfoPanel');
  const btnToggleInfoPanel = document.getElementById('btnToggleInfoPanel');
  const btnCloseInfoPanel = document.getElementById('btnCloseInfoPanel');
  const infoPanelAvatar = document.getElementById('infoPanelAvatar');
  const infoPanelTitle = document.getElementById('infoPanelTitle');
  const infoPanelSub = document.getElementById('infoPanelSub');
  const infoParticipantsCount = document.getElementById('infoParticipantsCount');
  const infoParticipantsList = document.getElementById('infoParticipantsList');

  // Mobile Back Button
  const btnMobileBack = document.getElementById('btnMobileBackToChats');
  const chatSidebar = document.getElementById('chatSidebar');

  // Status Modal
  const statusModal = document.getElementById('statusModal');
  const closeStatusModalBtn = document.getElementById('closeStatusModalBtn');
  const statusViewerBox = document.getElementById('statusViewerBox');
  const statusViewAvatar = document.getElementById('statusViewAvatar');
  const statusViewAuthor = document.getElementById('statusViewAuthor');
  const statusViewTime = document.getElementById('statusViewTime');
  const statusViewText = document.getElementById('statusViewText');
  const postStatusForm = document.getElementById('postStatusForm');
  const statusTextInput = document.getElementById('statusTextInput');
  const btnPublishStatus = document.getElementById('btnPublishStatus');

  // New Chat Modal
  const btnOpenNewChat = document.getElementById('btnOpenNewChat');
  const newChatModal = document.getElementById('newChatModal');
  const closeNewChatModalBtn = document.getElementById('closeNewChatModalBtn');
  const tabDirectChat = document.getElementById('tabDirectChat');
  const tabGroupChat = document.getElementById('tabGroupChat');
  const directChatSection = document.getElementById('directChatSection');
  const groupChatForm = document.getElementById('groupChatForm');
  const collaboratorPickerList = document.getElementById('collaboratorPickerList');
  const cancelGroupBtn = document.getElementById('cancelGroupBtn');

  // Current Session & State
  const currentUser = AuthService.getCurrentUserSession() || {
    username: 'Balajikumar',
    name: 'Balaji',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'
  };

  let conversations = [];
  let statuses = [];
  let activeConversationId = 'conv-1';
  let activeFilter = 'all';
  let searchQuery = '';
  let replyingTo = null;
  let pollingInterval = null;

  // --------------------------------------------------------------------------
  // 1. Initial Load
  // --------------------------------------------------------------------------
  async function loadInitialData() {
    try {
      const [convsRes, statusesRes] = await Promise.all([
        CommunityService.getConversations(),
        CommunityService.getStatuses()
      ]);

      conversations = Array.isArray(convsRes) ? convsRes : [];
      statuses = Array.isArray(statusesRes) ? statusesRes : [];

      if (conversations.length > 0 && !conversations.some(c => c.id === activeConversationId)) {
        activeConversationId = conversations[0].id;
      }

      renderStatuses();
      renderConversations();
      renderActiveChat();
      populateCollaboratorPicker();
      startPolling();
    } catch (err) {
      console.error('Error loading community data:', err);
    }
  }

  // --------------------------------------------------------------------------
  // 2. 24-Hour Developer Status Strip
  // --------------------------------------------------------------------------
  function renderStatuses() {
    if (!statusStrip) return;

    let html = `
      <div class="status-circle-item" id="btnOpenPostStatus">
        <div class="status-avatar-wrapper empty-status">
          <img src="${currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80'}" alt="You" class="status-avatar-img" />
          <span class="status-add-plus">+</span>
        </div>
        <span class="status-author-name">Your Status</span>
      </div>
    `;

    html += statuses.map(st => `
      <div class="status-circle-item status-user-item" data-status-id="${escapeHtml(st.id)}">
        <div class="status-avatar-wrapper">
          <img src="${st.authorAvatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&q=80'}" alt="${escapeHtml(st.authorName || st.author)}" class="status-avatar-img" />
        </div>
        <span class="status-author-name">${escapeHtml(st.authorName || st.author)}</span>
      </div>
    `).join('');

    statusStrip.innerHTML = html;

    const btnPost = document.getElementById('btnOpenPostStatus');
    if (btnPost) {
      btnPost.addEventListener('click', () => {
        openStatusModal(null);
      });
    }

    statusStrip.querySelectorAll('.status-user-item').forEach(item => {
      item.addEventListener('click', () => {
        const sid = item.getAttribute('data-status-id');
        const st = statuses.find(s => s.id === sid);
        if (st) openStatusModal(st);
      });
    });
  }

  // --------------------------------------------------------------------------
  // 3. Conversation List & Filtering
  // --------------------------------------------------------------------------
  function renderConversations() {
    if (!convListEl) return;

    const filtered = conversations.filter(c => {
      // 1. Tab filter
      if (activeFilter === 'direct' && c.type !== 'direct') return false;
      if (activeFilter === 'group' && c.type !== 'group') return false;
      if (activeFilter === 'channels' && c.type !== 'channel') return false;

      // 2. Search query
      if (searchQuery) {
        const title = (c.title || '').toLowerCase();
        const snippet = (c.lastMessage?.text || c.snippet || '').toLowerCase();
        return title.includes(searchQuery) || snippet.includes(searchQuery);
      }
      return true;
    });

    if (filtered.length === 0) {
      convListEl.innerHTML = `
        <div class="p-6 text-center text-secondary" style="font-size: 13px;">
          No conversations found matching "${escapeHtml(searchQuery)}".
        </div>`;
      return;
    }

    convListEl.innerHTML = filtered.map(c => {
      const isActive = c.id === activeConversationId;
      const snippet = c.lastMessage?.text || c.snippet || 'No messages yet';
      const time = c.lastMessage?.time || c.time || '';
      const unread = c.unreadCount || 0;
      const isOnline = Boolean(c.isOnline);

      return `
        <div class="chat-conv-item ${isActive ? 'active' : ''}" data-conv-id="${escapeHtml(c.id)}">
          <div class="conv-avatar-box">
            <img src="${c.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80'}" alt="${escapeHtml(c.title)}" class="conv-avatar" />
            ${isOnline ? '<span class="conv-online-dot"></span>' : ''}
          </div>
          <div class="conv-info">
            <div class="conv-title-row">
              <span class="conv-title">${escapeHtml(c.title)}</span>
              <span class="conv-time">${escapeHtml(time)}</span>
            </div>
            <div class="conv-snippet-row">
              <span class="conv-snippet">${escapeHtml(snippet)}</span>
              ${unread > 0 ? `<span class="conv-unread-badge">${unread}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    convListEl.querySelectorAll('.chat-conv-item').forEach(item => {
      item.addEventListener('click', async () => {
        const convId = item.getAttribute('data-conv-id');
        if (convId !== activeConversationId) {
          activeConversationId = convId;
          renderConversations();
          renderActiveChat();
          try {
            await CommunityService.markConversationRead(convId);
            const found = conversations.find(c => c.id === convId);
            if (found) found.unreadCount = 0;
            renderConversations();
          } catch (e) {
            console.warn('Could not mark read:', e);
          }
        }
        // Mobile layout: hide sidebar when conversation is tapped
        if (window.innerWidth < 768 && chatSidebar) {
          chatSidebar.classList.add('hidden-mobile');
        }
      });
    });
  }

  // Filter Tabs
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeFilter = tab.getAttribute('data-filter') || 'all';
      renderConversations();
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value.trim().toLowerCase();
      renderConversations();
    });
  }

  // --------------------------------------------------------------------------
  // 4. Active Chat & Message Stream
  // --------------------------------------------------------------------------
  async function renderActiveChat() {
    const currentConv = conversations.find(c => c.id === activeConversationId) || conversations[0];
    if (!currentConv) return;

    if (activeChatAvatar) activeChatAvatar.src = currentConv.avatar || '';
    if (activeChatTitle) activeChatTitle.textContent = currentConv.title || 'Discussion';

    const subtitleText = currentConv.type === 'group'
      ? `${(currentConv.participants || []).length || 3} members &bull; Project Squad`
      : (currentConv.isOnline ? 'Active Now' : 'Offline');

    if (activeChatSubtitle) activeChatSubtitle.innerHTML = subtitleText;

    // Update Right Info Panel
    if (infoPanelAvatar) infoPanelAvatar.src = currentConv.avatar || '';
    if (infoPanelTitle) infoPanelTitle.textContent = currentConv.title;
    if (infoPanelSub) infoPanelSub.textContent = currentConv.description || subtitleText;

    if (infoParticipantsList && currentConv.participants) {
      if (infoParticipantsCount) infoParticipantsCount.textContent = currentConv.participants.length;
      infoParticipantsList.innerHTML = currentConv.participants.map(p => `
        <div class="member-list-item">
          <img src="${p.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=64&q=80'}" alt="${escapeHtml(p.name)}" class="member-list-avatar" />
          <div>
            <div style="font-size: 13px; font-weight: 600;">${escapeHtml(p.name)}</div>
            <div class="text-secondary" style="font-size: 11px;">${escapeHtml(p.role || 'Member')}</div>
          </div>
        </div>
      `).join('');
    }

    // Fetch and render messages
    await fetchAndRenderMessages();
  }

  async function fetchAndRenderMessages(keepScrollPosition = false) {
    if (!messagesContainer) return;

    try {
      const messages = await CommunityService.getConversationMessages(activeConversationId);
      if (!Array.isArray(messages)) return;

      if (messages.length === 0) {
        messagesContainer.innerHTML = `
          <div class="p-6 text-center text-secondary m-auto">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="margin-bottom: 8px; opacity: 0.5;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <div style="font-weight: 600; font-size: 14px;">No messages yet</div>
            <div style="font-size: 12.5px;">Send a message to start the conversation!</div>
          </div>`;
        return;
      }

      const currentScrollTop = messagesContainer.scrollTop;
      const isNearBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 80;

      let html = `<div class="chat-date-divider"><span class="chat-date-pill">Today</span></div>`;

      html += messages.map(msg => {
        const isOutgoing = (msg.sender || '').toLowerCase() === (currentUser.username || '').toLowerCase() || msg.isSelf;
        const bubbleClass = isOutgoing ? 'outgoing' : 'incoming';
        const senderName = msg.senderName || msg.sender || 'Developer';
        const reactions = msg.reactions || [];

        return `
          <div class="chat-bubble-row ${bubbleClass}" data-msg-id="${escapeHtml(msg.id)}">
            <!-- Bubble Hover Action Menu -->
            <div class="bubble-hover-actions">
              <button class="bubble-action-btn action-quick-react" data-emoji="👍" title="Thumbs up">👍</button>
              <button class="bubble-action-btn action-quick-react" data-emoji="🚀" title="Rocket">🚀</button>
              <button class="bubble-action-btn action-quick-react" data-emoji="❤️" title="Love">❤️</button>
              <button class="bubble-action-btn action-reply-msg" data-msg-id="${escapeHtml(msg.id)}" data-sender="${escapeHtml(senderName)}" data-snippet="${escapeHtml(msg.text.slice(0, 50))}" title="Reply">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
              </button>
            </div>

            <div class="chat-bubble-card">
              ${!isOutgoing ? `<div class="bubble-sender-name">${escapeHtml(senderName)}</div>` : ''}

              ${msg.replyTo ? `
                <div class="bubble-reply-quote">
                  <div class="bubble-reply-sender">${escapeHtml(msg.replyTo.senderName || 'Developer')}</div>
                  <div class="bubble-reply-text">${escapeHtml(msg.replyTo.text || '')}</div>
                </div>
              ` : ''}

              <div class="bubble-text-content">
                ${formatMessageText(msg.text)}
              </div>

              <div class="bubble-meta">
                <span>${escapeHtml(msg.time || '')}</span>
                ${isOutgoing ? `<span class="read-receipt-check" title="Read">&#10003;&#10003;</span>` : ''}
              </div>
            </div>

            ${reactions.length > 0 ? `
              <div class="bubble-reactions-row">
                ${reactions.map(r => `
                  <button class="reaction-pill" data-msg-id="${escapeHtml(msg.id)}" data-emoji="${escapeHtml(r.emoji)}">
                    <span>${escapeHtml(r.emoji)}</span>
                    <span style="font-weight: 600; font-size: 10px;">${r.count || 1}</span>
                  </button>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

      messagesContainer.innerHTML = html;

      // Wire Reaction buttons on bubbles
      messagesContainer.querySelectorAll('.action-quick-react').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const bubble = btn.closest('.chat-bubble-row');
          const msgId = bubble.getAttribute('data-msg-id');
          const emoji = btn.getAttribute('data-emoji');
          await CommunityService.reactToMessage(msgId, emoji, activeConversationId);
          fetchAndRenderMessages(true);
        });
      });

      messagesContainer.querySelectorAll('.reaction-pill').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const msgId = btn.getAttribute('data-msg-id');
          const emoji = btn.getAttribute('data-emoji');
          await CommunityService.reactToMessage(msgId, emoji, activeConversationId);
          fetchAndRenderMessages(true);
        });
      });

      // Wire Reply button
      messagesContainer.querySelectorAll('.action-reply-msg').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-msg-id');
          const sender = btn.getAttribute('data-sender');
          const snippet = btn.getAttribute('data-snippet');
          setReplyContext(id, sender, snippet);
        });
      });

      // Scroll Handling
      if (!keepScrollPosition || isNearBottom) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      } else {
        messagesContainer.scrollTop = currentScrollTop;
      }
    } catch (err) {
      console.warn('Could not fetch messages:', err);
    }
  }

  // --------------------------------------------------------------------------
  // 5. Sending Messages & Replies
  // --------------------------------------------------------------------------
  function setReplyContext(id, sender, snippet) {
    replyingTo = { id, senderName: sender, text: snippet };
    if (replyPreviewBar) {
      replyPreviewBar.style.display = 'flex';
      if (replyPreviewSender) replyPreviewSender.textContent = `Replying to ${sender}`;
      if (replyPreviewText) replyPreviewText.textContent = snippet;
    }
    if (chatInput) chatInput.focus();
  }

  function clearReplyContext() {
    replyingTo = null;
    if (replyPreviewBar) replyPreviewBar.style.display = 'none';
  }

  if (btnCancelReply) btnCancelReply.addEventListener('click', clearReplyContext);

  async function handleSendMessage() {
    if (!chatInput) return;
    const text = chatInput.value.trim();
    if (!text) return;

    chatInput.value = '';
    const replyPayload = replyingTo ? { id: replyingTo.id, senderName: replyingTo.senderName, text: replyingTo.text } : null;
    clearReplyContext();

    try {
      await CommunityService.sendConversationMessage(activeConversationId, text, replyPayload);
      await fetchAndRenderMessages(false);
      // Update local last message in conversation list
      const conv = conversations.find(c => c.id === activeConversationId);
      if (conv) {
        conv.lastMessage = { text, time: 'Just now', sender: currentUser.username };
        renderConversations();
      }
    } catch (err) {
      toastDanger('Failed to send message. Please try again.');
    }
  }

  if (sendBtn) sendBtn.addEventListener('click', handleSendMessage);
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });
  }

  // --------------------------------------------------------------------------
  // 6. Quick Emoji Popover
  // --------------------------------------------------------------------------
  if (btnToggleEmoji && emojiPopover) {
    btnToggleEmoji.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = emojiPopover.style.display === 'flex';
      emojiPopover.style.display = isVisible ? 'none' : 'flex';
    });

    emojiPopover.querySelectorAll('.emoji-item-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const emoji = btn.getAttribute('data-emoji');
        if (chatInput) {
          chatInput.value += emoji;
          chatInput.focus();
        }
        emojiPopover.style.display = 'none';
      });
    });

    document.addEventListener('click', (e) => {
      if (!emojiPopover.contains(e.target) && e.target !== btnToggleEmoji) {
        emojiPopover.style.display = 'none';
      }
    });
  }

  // --------------------------------------------------------------------------
  // 7. Right Info Panel Toggle
  // --------------------------------------------------------------------------
  if (btnToggleInfoPanel && infoPanel) {
    btnToggleInfoPanel.addEventListener('click', () => {
      const isHidden = infoPanel.style.display === 'none';
      infoPanel.style.display = isHidden ? 'flex' : 'none';
    });
  }
  if (btnCloseInfoPanel && infoPanel) {
    btnCloseInfoPanel.addEventListener('click', () => {
      infoPanel.style.display = 'none';
    });
  }

  // Mobile Back Button
  if (btnMobileBack && chatSidebar) {
    btnMobileBack.addEventListener('click', () => {
      chatSidebar.classList.remove('hidden-mobile');
    });
  }

  // --------------------------------------------------------------------------
  // 8. 24-Hour Status Modal
  // --------------------------------------------------------------------------
  function openStatusModal(selectedStatus) {
    if (!statusModal) return;
    statusModal.style.display = 'flex';

    if (selectedStatus && statusViewerBox) {
      statusViewerBox.style.display = 'block';
      if (statusViewAvatar) statusViewAvatar.src = selectedStatus.authorAvatar || '';
      if (statusViewAuthor) statusViewAuthor.textContent = selectedStatus.authorName || selectedStatus.author;
      if (statusViewTime) statusViewTime.textContent = selectedStatus.time || 'Today';
      if (statusViewText) statusViewText.textContent = selectedStatus.text;
    } else if (statusViewerBox) {
      statusViewerBox.style.display = 'none';
    }
  }

  function closeStatusModal() {
    if (statusModal) statusModal.style.display = 'none';
  }

  if (closeStatusModalBtn) closeStatusModalBtn.addEventListener('click', closeStatusModal);

  if (postStatusForm) {
    postStatusForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = statusTextInput ? statusTextInput.value.trim() : '';
      if (!text) return;

      if (btnPublishStatus) {
        btnPublishStatus.disabled = true;
        btnPublishStatus.innerHTML = '<span class="btn-spinner"></span> Posting...';
      }

      try {
        await CommunityService.publishStatus(text);
        toastSuccess('Status posted! Visible to team for 24 hours.', 'Status Published');
        closeStatusModal();
        postStatusForm.reset();
        const updated = await CommunityService.getStatuses();
        statuses = Array.isArray(updated) ? updated : [];
        renderStatuses();
      } catch (err) {
        toastDanger('Failed to post status.');
      } finally {
        if (btnPublishStatus) {
          btnPublishStatus.disabled = false;
          btnPublishStatus.innerHTML = 'Post Status &rarr;';
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // 9. New Chat / Group Modal
  // --------------------------------------------------------------------------
  function populateCollaboratorPicker() {
    if (!collaboratorPickerList) return;
    const sampleDevs = [
      { name: 'Priya S', username: 'priyas', role: 'Fullstack Developer', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&q=80' },
      { name: 'Naveen Kumar D', username: 'naveen3438', role: 'Lead Maintainer', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=64&q=80' },
      { name: 'Arjun', username: 'arjun', role: 'Frontend Developer', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=64&q=80' },
      { name: 'Sneha', username: 'sneha', role: 'Backend Developer', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=64&q=80' },
      { name: 'Karthik', username: 'karthik', role: 'Systems Developer', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=64&q=80' }
    ];

    collaboratorPickerList.innerHTML = sampleDevs.map(dev => `
      <div class="d-flex align-items-center justify-content-between p-2 rounded cursor-pointer collaborator-item-select" data-username="${escapeHtml(dev.username)}" data-name="${escapeHtml(dev.name)}" data-avatar="${dev.avatar}" style="background: var(--color-surface-subtle); border: 1px solid var(--color-border); transition: all 0.15s ease;">
        <div class="d-flex align-items-center gap-2">
          <img src="${dev.avatar}" alt="${escapeHtml(dev.name)}" style="width: 32px; height: 32px; border-radius: 50%;" />
          <div>
            <div style="font-weight: 600; font-size: 13px;">${escapeHtml(dev.name)}</div>
            <div class="text-secondary" style="font-size: 11px;">@${escapeHtml(dev.username)} &bull; ${escapeHtml(dev.role)}</div>
          </div>
        </div>
        <button class="btn btn-outline btn-sm btn-pill" style="font-size: 11px; padding: 2px 8px;">Chat &rarr;</button>
      </div>
    `).join('');

    collaboratorPickerList.querySelectorAll('.collaborator-item-select').forEach(card => {
      card.addEventListener('click', async () => {
        const username = card.getAttribute('data-username');
        const name = card.getAttribute('data-name');
        const avatar = card.getAttribute('data-avatar');

        // Check if direct conversation already exists
        let existing = conversations.find(c => c.type === 'direct' && c.recipientUsername === username);
        if (!existing) {
          const newConv = {
            id: `conv-direct-${username}-${Date.now()}`,
            type: 'direct',
            title: name,
            recipientUsername: username,
            avatar: avatar,
            isOnline: true,
            unreadCount: 0,
            lastMessage: { text: 'Started conversation', time: 'Just now' },
            participants: [{ name, role: 'Collaborator', avatar }]
          };
          conversations.unshift(newConv);
          activeConversationId = newConv.id;
        } else {
          activeConversationId = existing.id;
        }

        renderConversations();
        renderActiveChat();
        closeNewChatModal();
        toastSuccess(`Chat opened with ${name}`);
      });
    });
  }

  function openNewChatModal() {
    if (newChatModal) newChatModal.style.display = 'flex';
  }
  function closeNewChatModal() {
    if (newChatModal) newChatModal.style.display = 'none';
  }

  if (btnOpenNewChat) btnOpenNewChat.addEventListener('click', openNewChatModal);
  if (closeNewChatModalBtn) closeNewChatModalBtn.addEventListener('click', closeNewChatModal);
  if (cancelGroupBtn) cancelGroupBtn.addEventListener('click', closeNewChatModal);

  if (tabDirectChat && tabGroupChat) {
    tabDirectChat.addEventListener('click', () => {
      tabDirectChat.className = 'btn btn-sm btn-primary btn-pill flex-1';
      tabGroupChat.className = 'btn btn-sm btn-outline btn-pill flex-1';
      if (directChatSection) directChatSection.style.display = 'block';
      if (groupChatForm) groupChatForm.style.display = 'none';
    });
    tabGroupChat.addEventListener('click', () => {
      tabGroupChat.className = 'btn btn-sm btn-primary btn-pill flex-1';
      tabDirectChat.className = 'btn btn-sm btn-outline btn-pill flex-1';
      if (directChatSection) directChatSection.style.display = 'none';
      if (groupChatForm) groupChatForm.style.display = 'block';
    });
  }

  if (groupChatForm) {
    groupChatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('newGroupName')?.value.trim();
      const repo = document.getElementById('newGroupRepo')?.value;
      if (!title) return;

      const newGroup = {
        id: `conv-group-${Date.now()}`,
        type: 'group',
        title: title,
        repository: repo,
        avatar: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=120&q=80',
        unreadCount: 0,
        description: `Project squad discussion for ${repo}`,
        lastMessage: { text: `Group created for ${repo}`, time: 'Just now' },
        participants: [
          { name: currentUser.name, role: 'Owner', avatar: currentUser.avatar },
          { name: 'Priya S', role: 'Fullstack Developer', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&q=80' }
        ]
      };

      try {
        await CommunityService.createConversation(newGroup);
        conversations.unshift(newGroup);
        activeConversationId = newGroup.id;
        renderConversations();
        renderActiveChat();
        closeNewChatModal();
        groupChatForm.reset();
        toastSuccess(`Group "${title}" created successfully!`, 'Group Created');
      } catch (err) {
        toastDanger('Failed to create project squad group.');
      }
    });
  }

  // --------------------------------------------------------------------------
  // 10. Near-Realtime Polling (every 5s)
  // --------------------------------------------------------------------------
  function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(async () => {
      if (document.visibilityState === 'visible') {
        fetchAndRenderMessages(true);
      }
    }, 5000);
  }

  // Initial Boot
  loadInitialData();
}
