import type { UUID } from 'node:crypto';
import { claudeGlobals } from './globals';

export function getSessionId(): UUID | undefined {
  return claudeGlobals.sessionId;
}
