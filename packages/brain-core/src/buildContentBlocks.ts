import type { Base64PDFSource, ContentBlockParam, DocumentBlockParam, TextBlockParam } from '@anthropic-ai/sdk/resources';
import { Instant } from '@js-joda/core';
import { logger } from '@simple-claude-bot/shared/logger';
import { timestampFormatter } from '@simple-claude-bot/shared/timestampFormatter';
import { zone } from '@simple-claude-bot/shared/zone';
import { parseContentType } from './parseContentType';
import { sanitiseSystemReminders } from './sanitiseInput';
import type { PlatformMessageOutput } from './types';

export function buildContentBlocks(messages: PlatformMessageOutput[]): ContentBlockParam[] {
  const blocks: ContentBlockParam[] = [];

  for (const m of messages) {
    const zdt = Instant.ofEpochMilli(m.createdTimestamp).atZone(zone);
    const content = sanitiseSystemReminders(m.content);
    blocks.push({
      type: 'text',
      text: `[${zdt.format(timestampFormatter)}] ${m.authorDisplayName} (${m.authorId}): ${content}`,
    });

    if (m.attachments.length > 0) {
      logger.info(`Processing ${m.attachments.length} attachments`);
    }
    for (const attachment of m.attachments) {
      const { baseType } = parseContentType(attachment.contentType);
      logger.info('Attachment', {
        contentType: attachment.contentType,
        baseType,
        url: attachment.url,
        dataLength: attachment.data?.length,
      });
      if (attachment.data) {
        switch (baseType) {
          case 'text/plain': {
            const MAX_TEXT_LENGTH = 10_000;
            const fullText = sanitiseSystemReminders(Buffer.from(attachment.data, 'base64').toString());
            const truncated = fullText.length > MAX_TEXT_LENGTH;
            const text = truncated ? `${fullText.slice(0, MAX_TEXT_LENGTH)}\n\n[truncated: original was ${fullText.length.toLocaleString()} characters, showing first ${MAX_TEXT_LENGTH.toLocaleString()}]` : fullText;
            logger.info(`Adding ${baseType} attachment`, {
              text,
              truncated,
              originalLength: fullText.length,
            });
            blocks.push({
              type: 'text',
              text,
            } satisfies TextBlockParam);
            break;
          }
          case 'application/pdf': {
            logger.info(`Adding ${baseType} attachment`);
            blocks.push({
              type: 'document',
              source: {
                type: 'base64',
                media_type: baseType,
                data: attachment.data,
              } satisfies Base64PDFSource,
            } satisfies DocumentBlockParam);
            break;
          }
          case 'image/jpeg':
          case 'image/png':
          case 'image/gif':
          case 'image/webp': {
            logger.info(`Adding ${baseType} attachment`);
            blocks.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: baseType,
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
