import { logger } from '@simple-claude-bot/shared/logger';
import type { Message } from 'discord.js';
import type { PlatformAttachmentInput, PlatformMessageInput } from '../../types';

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

export class DiscordMessage implements PlatformMessageInput {
  public readonly authorId: string;
  public readonly authorDisplayName: string;
  public readonly authorIsBot: boolean;
  public readonly content: string;
  public readonly createdTimestamp: number;
  public readonly attachments: PlatformAttachmentInput[];
  /** @internal */
  public readonly _raw: Message;

  private constructor(message: Message, attachments: PlatformAttachmentInput[]) {
    this._raw = message;
    this.authorId = message.author.id;
    this.authorDisplayName = message.author.displayName;
    this.authorIsBot = message.author.bot;
    this.content = message.content;
    this.createdTimestamp = message.createdTimestamp;
    this.attachments = attachments;
  }

  public static async from(message: Message): Promise<DiscordMessage> {
    const attachments: PlatformAttachmentInput[] = await Promise.all(
      [...message.attachments.values()].map(async (a) => {
        const isImage = a.contentType != null && IMAGE_CONTENT_TYPES.has(a.contentType);
        const data = isImage && a.contentType != null ? await downloadAttachment(a.url) : undefined;
        return {
          url: a.url,
          contentType: a.contentType,
          data,
        } satisfies PlatformAttachmentInput;
      }),
    );
    return new DiscordMessage(message, attachments);
  }
}
