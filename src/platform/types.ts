export interface PlatformAttachment {
  readonly url: string;
  readonly contentType: string | null;
}

export interface PlatformMessage {
  readonly authorId: string;
  readonly authorDisplayName: string;
  readonly authorIsBot: boolean;
  readonly content: string;
  readonly createdTimestamp: number;
  readonly attachments: PlatformAttachment[];
}

export interface PlatformChannel {
  sendMessage(content: string): Promise<void>;
  replyTo(message: PlatformMessage, content: string): Promise<void>;
  sendTyping(): Promise<void>;
  fetchHistory(limit: number): Promise<PlatformMessage[]>;
}
