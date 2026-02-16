import type { UUID } from 'node:crypto';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';

export interface SandboxConfig {
  readonly enabled: boolean;
  readonly directory: string;
}
export type ClaudeModels = 'claude-opus-4-6' | 'claude-sonnet-4-5-20250929' | 'claude-haiku-4-5-20251001';

export type SDKMessageWithSubtype = SDKMessage & { subtype?: string };

export type ImageContentType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

export type ClaudeGlobals = {
  claudeDir: string | undefined;
  SESSION_FILE: string | undefined;
  DIRECT_SESSION_FILE: string | undefined;
  COMPACT_FILE: string | undefined;
  sessionId: UUID | undefined;
  directSessionId: UUID | undefined;
};
