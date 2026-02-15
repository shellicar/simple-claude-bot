import type { UUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { claudeGlobals } from '../globals';

export function saveSession(id: UUID): void {
  claudeGlobals.sessionId = id;
  if (claudeGlobals.SESSION_FILE == null) {
    throw new Error('No session file');
  }
  writeFileSync(claudeGlobals.SESSION_FILE, id);
}
