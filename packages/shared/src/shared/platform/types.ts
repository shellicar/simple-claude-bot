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

