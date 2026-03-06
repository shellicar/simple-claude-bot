import type { PlatformMessageInput } from '../types';

export interface PlatformChannel {
  sendMessage(content: string): Promise<string[]>;
  replyTo(message: PlatformMessageInput, content: string): Promise<string[]>;
  sendTyping(): Promise<void>;
  fetchHistory(limit: number): Promise<PlatformMessageInput[]>;
  trackMessage(message: PlatformMessageInput): void;
  clearTracked(): void;
}
