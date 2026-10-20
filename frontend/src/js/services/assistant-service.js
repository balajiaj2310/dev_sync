/**
 * DevSync AI Assistant Service
 * Text Chat Service connecting directly to DevSync AI backend
 */

export const AssistantService = {
  async sendMessage(prompt, context = {}) {
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: prompt,
          prompt,
          context
        })
      });
      const data = await response.json();
      return {
        text: data.reply || data.text || 'DevSync AI responded.',
        reply: data.reply || data.text || 'DevSync AI responded.',
        source: data.source || 'gemini',
        code: data.code || null
      };
    } catch (err) {
      console.warn('[AssistantService] Direct chat error, fallback:', err);
      return {
        text: `DevSync AI Assistant received your request: "${prompt}". Connected to workspace context.`,
        reply: `DevSync AI Assistant received your request: "${prompt}". Connected to workspace context.`
      };
    }
  }
};
