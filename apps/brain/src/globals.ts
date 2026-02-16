import type { ClaudeGlobals } from './types';

// TODO: Replace mutable globals with proper dependency injection
export const claudeGlobals: ClaudeGlobals = {
  claudeDir: undefined,
  SESSION_FILE: undefined,
  DIRECT_SESSION_FILE: undefined,
  COMPACT_FILE: undefined,
  sessionId: undefined,
  directSessionId: undefined,
};
