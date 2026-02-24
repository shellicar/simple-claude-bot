import type { UUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { logger } from '@simple-claude-bot/shared/logger';
import { claudeGlobals } from '../globals';

export function setSessionId(id: UUID): void {
  claudeGlobals.sessionId = id;
  if (claudeGlobals.SESSION_FILE == null) {
    throw new Error('No session file');
  }
  writeFileSync(claudeGlobals.SESSION_FILE, id);
  logger.info(`Session switched to: ${id}`);
}
