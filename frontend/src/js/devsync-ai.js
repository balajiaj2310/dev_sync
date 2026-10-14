/*
 * DevSync floating AI assistant.
 *
 * Load this file only in the authenticated workspace layout.
 * Configure window.DEVSYNC_AI_CONFIG before this script:
 * window.DEVSYNC_AI_CONFIG = {
 *   endpoint: "/api/ai/chat",
 *   getAuthHeaders: () => ({ "Authorization": `Bearer ${yourToken}` })
 * };
 *
 * Expected endpoint request: POST { message: string, history: [{role, content}] }
 * Expected response: { reply: string }
 * The endpoint must be implemented by your backend. No fake AI replies are generated.
 */
(() => {
  "use strict";
  if (window.__DEVSYNC_AI_WIDGET_MOUNTED__) return;
  window.__DEVSYNC_AI_WIDGET_MOUNTED__ = true;

  const config = window.DEVSYNC_AI_CONFIG || {};
  const endpoint = typeof config.endpoint === "string" ? config.endpoint : "";
  const getAuthHeaders = typeof config.getAuthHeaders === "function"
    ? config.getAuthHeaders
    : () => ({});

  const icons = {
    chat: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6.5A7.5 7.5 0 1 1 20 11.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 10h8M8 13.5h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    sparkle: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" fill="currentColor"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    minus: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m21 3-7.2 18-3.8-7-7-3.8L21 3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 14 21 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
  };

  const create = (tag, className, attrs = {}) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === "text") node.textContent = value;
      else if (key === "html") node.innerHTML = value;
      else if (key === "hidden") node.hidden = Boolean(value);
      else node.setAttribute(key, value);
    });
    return node;
  };

  function mount() {
    // Do not render on public/auth pages. The script should be included only in
    // the authenticated layout; this guard is an additional safety check.
    const page = (location.pathname || "").toLowerCase();
    const publicPage = /sign[-_]?in|sign[-_]?up|register|forgot[-_]?password|reset[-_]?password|\/auth\/|404|500|403|401|405|429/.test(page);
    const authenticated = document.body?.dataset?.authenticated === "true" ||
      (document.body?.dataset?.page && !['landing', 'explore', 'pricing', 'contact', 'auth'].includes(document.body.dataset.page));
    if (publicPage || !authenticated) return;

    const root = create("div", "ds-ai");
    const launcher = create("button", "ds-ai__launcher", {
      type: "button", "aria-label": "Open DevSync AI Assistant",
      "aria-expanded": "false", "aria-controls": "ds-ai-panel",
      title: "DevSync AI Assistant", html: icons.chat
    });
    launcher.append(create("span", "ds-ai__launcher-dot", { "aria-hidden": "true" }));

    const panel = create("section", "ds-ai__panel", {
      id: "ds-ai-panel", role: "dialog", "aria-label": "DevSync AI Assistant",
      "aria-modal": "false", hidden: true
    });

    const header = create("header", "ds-ai__header");
    const avatar = create("div", "ds-ai__avatar", { html: icons.sparkle });
    const heading = create("div", "ds-ai__heading");
    heading.append(
      create("p", "ds-ai__title", { text: "DevSync AI Assistant" }),
      create("p", "ds-ai__subtitle", { text: "Coding help, when you need it" })
    );
    const headerActions = create("div", "ds-ai__header-actions");
    const minimize = create("button", "ds-ai__icon-btn", {
      type: "button", "aria-label": "Minimize chat", title: "Minimize", html: icons.minus
    });
    const close = create("button", "ds-ai__icon-btn", {
      type: "button", "aria-label": "Close chat", title: "Close", html: icons.close
    });
    headerActions.append(minimize, close);
    header.append(avatar, heading, headerActions);

    const messages = create("div", "ds-ai__messages", { "aria-live": "polite", "aria-relevant": "additions text" });
    const welcome = create("p", "ds-ai__welcome", {
      text: "Hi! I'm DevSync AI. Ask a programming question or choose a suggestion below."
    });
    const suggestions = create("div", "ds-ai__suggestions");
    [
      "Help me debug an error",
      "Explain a code snippet",
      "Review a pull request",
      "Generate a function"
    ].forEach(label => {
      const button = create("button", "ds-ai__suggestion", { type: "button", text: label });
      button.addEventListener("click", () => {
        input.value = label;
        input.focus();
        resizeInput();
      });
      suggestions.append(button);
    });
    messages.append(welcome, suggestions);

    const composer = create("div", "ds-ai__composer");
    const form = create("form", "ds-ai__form");
    const input = create("textarea", "ds-ai__input", {
      rows: "1", "aria-label": "Message DevSync AI",
      placeholder: "Ask a coding question…", maxlength: "8000"
    });
    const send = create("button", "ds-ai__send", {
      type: "submit", "aria-label": "Send message", title: "Send", html: icons.send
    });
    form.append(input, send);
    composer.append(form, create("p", "ds-ai__hint", { text: "Enter to send · Shift+Enter for a new line" }));
    panel.append(header, messages, composer);
    root.append(launcher, panel);
    document.body.append(root);

    let history = [];
    let busy = false;
    let minimized = false;

    function scrollToBottom() { messages.scrollTop = messages.scrollHeight; }
    function addMessage(role, text, error = false) {
      const row = create("div", `ds-ai__message ds-ai__message--${role}${error ? " ds-ai__message--error" : ""}`);
      const bubble = create("div", "ds-ai__bubble", { text });
      row.append(bubble);
      messages.append(row);
      scrollToBottom();
      return row;
    }
    function setOpen(open) {
      panel.hidden = !open;
      launcher.setAttribute("aria-expanded", String(open));
      launcher.setAttribute("aria-label", open ? "Close DevSync AI Assistant" : "Open DevSync AI Assistant");
      launcher.innerHTML = open ? icons.close : icons.chat;
      launcher.append(create("span", "ds-ai__launcher-dot", { "aria-hidden": "true" }));
      if (open) {
        minimized = false;
        input.focus({ preventScroll: true });
      } else launcher.focus({ preventScroll: true });
    }
    function resizeInput() {
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight, 110)}px`;
    }
    function setBusy(value) {
      busy = value;
      send.disabled = value;
      input.disabled = value;
      panel.classList.toggle("ds-ai--busy", value);
    }

    async function submitMessage(text) {
      const message = text.trim();
      if (!message || busy) return;
      if (!endpoint) {
        addMessage("assistant", "The AI service isn't connected yet. Configure window.DEVSYNC_AI_CONFIG.endpoint and implement the authenticated backend endpoint to enable real AI responses.", true);
        return;
      }
      addMessage("user", message);
      history.push({ role: "user", content: message });
      input.value = "";
      resizeInput();
      const typing = create("div", "ds-ai__typing", { text: "DevSync AI is thinking…" });
      messages.append(typing);
      scrollToBottom();
      setBusy(true);

      try {
        const authHeaders = await Promise.resolve(getAuthHeaders());
        const response = await fetch(endpoint, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ message, history: history.slice(-20) })
        });
        if (!response.ok) {
          let detail = "";
          try {
            const body = await response.json();
            detail = body.message || body.error || "";
          } catch (_) {}
          throw new Error(detail || `The AI service returned HTTP ${response.status}.`);
        }
        const data = await response.json();
        const reply = typeof data.reply === "string" ? data.reply.trim() : "";
        if (!reply) throw new Error("The AI service returned an empty response.");
        history.push({ role: "assistant", content: reply });
        addMessage("assistant", reply);
      } catch (error) {
        addMessage("assistant", `${error.message || "Unable to reach the AI service."} Please try again.`, true);
      } finally {
        typing.remove();
        setBusy(false);
        input.focus({ preventScroll: true });
      }
    }

    launcher.addEventListener("click", () => setOpen(panel.hidden));
    close.addEventListener("click", () => setOpen(false));
    minimize.addEventListener("click", () => {
      minimized = true;
      setOpen(false);
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      submitMessage(input.value);
    });
    input.addEventListener("input", resizeInput);
    input.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
      }
      if (event.key === "Escape") setOpen(false);
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !panel.hidden) setOpen(false);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})();
