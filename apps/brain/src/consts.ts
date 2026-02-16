import type { HookCallbackMatcher, HookEvent } from '@anthropic-ai/claude-agent-sdk';
import { logHook } from './logHook';
import type { ClaudeModels, ImageContentType } from './types';

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

export const claudePath = process.env.CLAUDE_PATH ?? 'claude';

export const ENV_PASSTHROUGH = new Set(['HOME', 'PATH', 'SHELL', 'USER', 'HOSTNAME', 'TZ', 'TERM', 'LANG', 'NODE_VERSION', 'BANANABOT_BUILD_TIME', 'BANANABOT_BUILD_HASH']);

export const IMAGE_CONTENT_TYPES = new Set<ImageContentType>(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
