import { fileURLToPath } from 'node:url';
import type { HookCallbackMatcher, HookEvent } from '@anthropic-ai/claude-agent-sdk';
import { logHook } from './logHook';
import type { ClaudeModels } from './types';

export const model: ClaudeModels = 'claude-opus-4-6';

export const hookMatcher: HookCallbackMatcher[] = [
  {
    hooks: [
      async (input) => {
        logHook(input);
        return { continue: true };
      },
    ],
  },
];

export const sdkHooks: Partial<Record<HookEvent, HookCallbackMatcher[]>> = {
  PostToolUse: hookMatcher,
  PostToolUseFailure: hookMatcher,
  SessionStart: hookMatcher,
  SessionEnd: hookMatcher,
  SubagentStart: hookMatcher,
  SubagentStop: hookMatcher,
  Notification: hookMatcher,
};

const resolvedCliPath = fileURLToPath(import.meta.resolve('@anthropic-ai/claude-code/cli.js'));
export const claudePath = process.env.CLAUDE_PATH ?? resolvedCliPath;

export const ENV_PASSTHROUGH = new Set(['HOME', 'PATH', 'SHELL', 'USER', 'HOSTNAME', 'TZ', 'TERM', 'LANG', 'NODE_VERSION', 'BANANABOT_BUILD_TIME', 'BANANABOT_BUILD_HASH', 'CLAUDE_CODE_OAUTH_TOKEN']);
