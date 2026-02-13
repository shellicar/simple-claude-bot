import type { Message } from 'discord.js';
import type { PlatformAttachment, PlatformMessage } from '@simple-claude-bot/shared/shared/platform/types';

export class DiscordMessage implements PlatformMessage {
  public readonly authorId: string;
  public readonly authorDisplayName: string;
  public readonly authorIsBot: boolean;
  public readonly content: string;
  public readonly createdTimestamp: number;
  public readonly attachments: PlatformAttachment[];
  /** @internal */
  public readonly _raw: Message;

  public constructor(message: Message) {
    this._raw = message;
    this.authorId = message.author.id;
    this.authorDisplayName = message.author.displayName;
    this.authorIsBot = message.author.bot;
    this.content = message.content;
    this.createdTimestamp = message.createdTimestamp;
    this.attachments = [...message.attachments.values()].map(
      (a) =>
        ({
          url: a.url,
          contentType: a.contentType,
        }) satisfies PlatformAttachment,
    );
  }
}
