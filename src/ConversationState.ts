import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { ChatMessage } from './types.js';

const MAX_CONTEXT_TOKENS = 180_000;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export class ConversationState {
  private history: ChatMessage[] = [];

  constructor(private readonly filePath: string = 'conversation.json') {}

  static load(filePath: string = 'conversation.json'): ConversationState {
    const state = new ConversationState(filePath);
    if (existsSync(filePath)) {
      try {
        const data = readFileSync(filePath, 'utf-8');
        state.history = JSON.parse(data) as ChatMessage[];
        console.log(`Loaded ${state.history.length} messages from ${filePath}`);
      } catch {
        console.error('Failed to load conversation state, starting fresh');
      }
    }
    return state;
  }

  addUserMessage(content: string): void {
    this.history.push({ role: 'user', content });
    this.save();
  }

  addAssistantMessage(content: string): void {
    this.history.push({ role: 'assistant', content });
    this.save();
  }

  getMessages(): ChatMessage[] {
    const trimmed = [...this.history];
    while (trimmed.length > 0 && this.estimateMessageTokens(trimmed) > MAX_CONTEXT_TOKENS) {
      trimmed.shift();
      if (trimmed.length > 0 && trimmed[0].role === 'assistant') {
        trimmed.shift();
      }
    }
    return trimmed;
  }

  compact(): void {
    const trimmed = this.getMessages();
    this.history = trimmed;
    this.save();
  }

  private estimateMessageTokens(messages: ChatMessage[]): number {
    return messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
  }

  private save(): void {
    writeFileSync(this.filePath, JSON.stringify(this.history, null, 2));
  }
}
