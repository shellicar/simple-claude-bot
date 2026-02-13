import type { PlatformMessage } from '@simple-claude-bot/shared/shared/platform/types';

export interface PlatformChannel {
  sendMessage(content: string): Promise<void>;
  replyTo(message: PlatformMessage, content: string): Promise<void>;
  sendTyping(): Promise<void>;
  fetchHistory(limit: number): Promise<PlatformMessage[]>;
  trackMessage(message: PlatformMessage): void;
  clearTracked(): void;
}
