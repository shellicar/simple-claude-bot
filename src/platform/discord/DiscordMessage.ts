import type { Message } from 'discord.js';
import type { PlatformAttachment, PlatformMessage } from '../types.js';

export class DiscordMessage implements PlatformMessage {
  readonly authorId: string;
  readonly authorDisplayName: string;
  readonly authorIsBot: boolean;
  readonly content: string;
  readonly createdTimestamp: number;
  readonly attachments: PlatformAttachment[];
  /** @internal */
  readonly _raw: Message;

  constructor(message: Message) {
    this._raw = message;
    this.authorId = message.author.id;
    this.authorDisplayName = message.author.displayName;
    this.authorIsBot = message.author.bot;
    this.content = message.content;
    this.createdTimestamp = message.createdTimestamp;
    this.attachments = [...message.attachments.values()].map((a) => ({
      url: a.url,
      contentType: a.contentType,
    }) satisfies PlatformAttachment);
  }
}
