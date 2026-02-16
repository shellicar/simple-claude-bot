import type { ContentBlockParam } from '@anthropic-ai/sdk/resources';
import { Instant } from '@js-joda/core';
import { logger } from '@simple-claude-bot/shared/logger';
import { timestampFormatter } from '@simple-claude-bot/shared/timestampFormatter';
import { zone } from '@simple-claude-bot/shared/zone';
import { IMAGE_CONTENT_TYPES } from './consts';
import type { ImageContentType, PlatformMessageOutput } from './types';

export function buildContentBlocks(messages: PlatformMessageOutput[]): ContentBlockParam[] {
  const blocks: ContentBlockParam[] = [];

  for (const m of messages) {
    const zdt = Instant.ofEpochMilli(m.createdTimestamp).atZone(zone);
    blocks.push({
      type: 'text',
      text: `[${zdt.format(timestampFormatter)}] ${m.authorDisplayName} (${m.authorId}): ${m.content}`,
    });

    for (const attachment of m.attachments) {
      const imageContentType = attachment.contentType as ImageContentType;
      if (imageContentType && IMAGE_CONTENT_TYPES.has(imageContentType)) {
        if (attachment.data) {
          blocks.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: imageContentType,
              data: attachment.data,
            },
          });
        } else {
          logger.warn('Skipping image attachment without base64 data', { contentType: attachment.contentType, url: attachment.url });
        }
      } else {
        logger.warn('Skipping unsupported attachment type', { contentType: attachment.contentType, url: attachment.url });
      }
    }
  }

  return blocks;
}
