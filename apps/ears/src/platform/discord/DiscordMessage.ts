import { logger } from '@simple-claude-bot/shared/logger';
import type { PlatformAttachment, PlatformMessage } from '@simple-claude-bot/shared/shared/platform/types';
import type { Message } from 'discord.js';

const IMAGE_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

async function downloadAttachment(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      logger.warn(`Failed to download attachment: ${response.status} ${response.statusText}`);
      return undefined;
    }
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  } catch (error) {
    logger.warn(`Failed to download attachment ${url}: ${error}`);
    return undefined;
  }
}

export class DiscordMessage implements PlatformMessage {
  public readonly authorId: string;
  public readonly authorDisplayName: string;
  public readonly authorIsBot: boolean;
  public readonly content: string;
  public readonly createdTimestamp: number;
  public readonly attachments: PlatformAttachment[];
  /** @internal */
  public readonly _raw: Message;

  private constructor(message: Message, attachments: PlatformAttachment[]) {
    this._raw = message;
    this.authorId = message.author.id;
    this.authorDisplayName = message.author.displayName;
    this.authorIsBot = message.author.bot;
    this.content = message.content;
    this.createdTimestamp = message.createdTimestamp;
    this.attachments = attachments;
  }

  public static async from(message: Message): Promise<DiscordMessage> {
    const attachments: PlatformAttachment[] = await Promise.all(
      [...message.attachments.values()].map(async (a) => {
        const isImage = a.contentType != null && IMAGE_CONTENT_TYPES.has(a.contentType);
        const data = isImage && a.contentType != null ? await downloadAttachment(a.url) : undefined;
        return {
          url: a.url,
          contentType: a.contentType,
          data,
        } satisfies PlatformAttachment;
      }),
    );
    return new DiscordMessage(message, attachments);
  }
}
