import { ChatMessage } from './types.js';

const MAX_CONTEXT_TOKENS = 180_000;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export class ConversationState {
  private history: ChatMessage[] = [];

  addUserMessage(content: string): void {
    this.history.push({ role: 'user', content });
    this.trim();
  }

  addAssistantMessage(content: string): void {
    this.history.push({ role: 'assistant', content });
  }

  getMessages(): ChatMessage[] {
    return this.history;
  }

  private trim(): void {
    while (this.history.length > 0 && this.estimateHistoryTokens() > MAX_CONTEXT_TOKENS) {
      this.history.shift();
      if (this.history.length > 0 && this.history[0].role === 'assistant') {
        this.history.shift();
      }
    }
  }

  private estimateHistoryTokens(): number {
    return this.history.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
  }
}
