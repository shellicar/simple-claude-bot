import type { UUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { logger } from '@simple-claude-bot/shared/logger';
import { uuidSchema } from '../requestSchemas';

export function loadSessionId(file: string): UUID | undefined {
  if (!existsSync(file)) {
    return undefined;
  }
  const value = readFileSync(file, 'utf-8').trim();
  if (!value) {
    return undefined;
  }
  const result = uuidSchema.safeParse(value);
  if (!result.success) {
    logger.warn(`Ignoring invalid session ID from ${file}: ${value}`);
    return undefined;
  }
  return result.data;
}
