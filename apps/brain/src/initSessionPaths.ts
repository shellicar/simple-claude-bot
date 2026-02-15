import { join } from 'node:path';
import { claudeGlobals } from './globals';
import { loadSessionId } from './session/loadSessionId';

export function initSessionPaths(configDir: string): void {
  claudeGlobals.claudeDir = configDir;
  claudeGlobals.SESSION_FILE = join(claudeGlobals.claudeDir, '.bot.session');
  claudeGlobals.DIRECT_SESSION_FILE = join(claudeGlobals.claudeDir, '.bot.direct-session');
  claudeGlobals.COMPACT_FILE = join(claudeGlobals.claudeDir, '.bot.compact');
  claudeGlobals.sessionId = loadSessionId(claudeGlobals.SESSION_FILE);
  claudeGlobals.directSessionId = loadSessionId(claudeGlobals.DIRECT_SESSION_FILE);
}
