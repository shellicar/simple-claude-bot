import type { PlatformMessageInput } from '../types';

export interface PlatformChannel {
  sendMessage(content: string): Promise<void>;
  replyTo(message: PlatformMessageInput, content: string): Promise<void>;
  sendTyping(): Promise<void>;
  fetchHistory(limit: number): Promise<PlatformMessageInput[]>;
  trackMessage(message: PlatformMessageInput): void;
  clearTracked(): void;
}
