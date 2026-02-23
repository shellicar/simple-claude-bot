import type { UUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { claudeGlobals } from '../globals';

export function saveDirectSession(id: UUID): void {
  claudeGlobals.directSessionId = id;
  if (claudeGlobals.DIRECT_SESSION_FILE == null) {
    throw new Error('No direct session file');
  }
  writeFileSync(claudeGlobals.DIRECT_SESSION_FILE, id);
}
