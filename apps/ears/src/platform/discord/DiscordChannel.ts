import type { PlatformMessage } from '@simple-claude-bot/shared/shared/platform/types';
import type { Message, TextChannel } from 'discord.js';
import { chunkMessage } from '../../chunkMessage';
import type { PlatformChannel } from '../types';
import { DiscordMessage } from './DiscordMessage.js';

export class DiscordChannel implements PlatformChannel {
  private readonly messagesByAuthorId = new Map<string, Message>();

  public constructor(private readonly channel: TextChannel) {}

  public trackMessage(message: PlatformMessage): void {
    if (message instanceof DiscordMessage) {
      this.messagesByAuthorId.set(message.authorId, message._raw);
    }
  }

  public clearTracked(): void {
    this.messagesByAuthorId.clear();
  }

  public async sendMessage(content: string): Promise<void> {
    for (const chunk of chunkMessage(content)) {
      await this.channel.send(chunk);
    }
  }

  public async replyTo(message: PlatformMessage, content: string): Promise<void> {
    const target = this.messagesByAuthorId.get(message.authorId);
    for (const chunk of chunkMessage(content)) {
      if (target) {
        await target.reply(chunk);
      } else {
        await this.channel.send(chunk);
      }
    }
  }

  public async sendTyping(): Promise<void> {
    await this.channel.sendTyping();
  }

  public async fetchHistory(limit: number): Promise<PlatformMessage[]> {
    const messages: Message[] = [];
    let lastId: string | undefined;

    const batchSize = 100;
    let remaining = limit;

    while (remaining > 0) {
      const fetchLimit = Math.min(batchSize, remaining);
      const fetched = await this.channel.messages.fetch({
        limit: fetchLimit,
        ...(lastId ? { before: lastId } : {}),
      });
      if (fetched.size === 0) {
        break;
      }
      messages.push(...fetched.values());
      lastId = fetched.last()?.id;
      remaining -= fetched.size;
      if (fetched.size < fetchLimit) {
        break;
      }
    }

    messages.reverse();
    return Promise.all(messages.map((m) => DiscordMessage.from(m)));
  }
}
