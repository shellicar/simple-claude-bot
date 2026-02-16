import type { Base64PDFSource, ContentBlockParam, DocumentBlockParam, TextBlockParam } from '@anthropic-ai/sdk/resources';
import { Instant } from '@js-joda/core';
import { logger } from '@simple-claude-bot/shared/logger';
import { timestampFormatter } from '@simple-claude-bot/shared/timestampFormatter';
import { zone } from '@simple-claude-bot/shared/zone';
import type { PlatformMessageOutput } from './types';

export function buildContentBlocks(messages: PlatformMessageOutput[]): ContentBlockParam[] {
  const blocks: ContentBlockParam[] = [];

  for (const m of messages) {
    const zdt = Instant.ofEpochMilli(m.createdTimestamp).atZone(zone);
    blocks.push({
      type: 'text',
      text: `[${zdt.format(timestampFormatter)}] ${m.authorDisplayName} (${m.authorId}): ${m.content}`,
    });

    for (const attachment of m.attachments) {
      if (attachment.data) {
        switch (attachment.contentType) {
          case 'text/plain': {
            logger.info(`Adding ${attachment.contentType} attachment`);

            blocks.push({
              type: 'text',
              text: attachment.data,
            } satisfies TextBlockParam);
            break;
          }
          case 'application/pdf': {
            logger.info(`Adding ${attachment.contentType} attachment`);
            blocks.push({
              type: 'document',
              source: {
                type: 'base64',
                media_type: attachment.contentType,
                data: attachment.data,
              } satisfies Base64PDFSource,
            } satisfies DocumentBlockParam);
            break;
          }
          case 'image/jpeg':
          case 'image/png':
          case 'image/gif':
          case 'image/webp': {
            logger.info(`Adding ${attachment.contentType} attachment`);
            blocks.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: attachment.contentType,
                data: attachment.data,
              },
            });
            break;
          }
        }
      }
    }
  }

  return blocks;
}
