import type { Options } from '@anthropic-ai/claude-agent-sdk';
import { buildSandboxEnv } from './buildSandboxEnv';
import { claudePath, model, sdkHooks } from './consts';
import type { SandboxConfig } from './types';

export function buildQueryOptions(params: { systemPrompt: string; allowedTools: string[]; maxTurns: number; sandboxConfig: SandboxConfig; sessionId?: string }): Options {
  const { systemPrompt, allowedTools, maxTurns, sandboxConfig, sessionId } = params;
  const sandboxEnabled = sandboxConfig.enabled;

  return {
    pathToClaudeCodeExecutable: claudePath,
    model,
    cwd: sandboxConfig.directory,
    allowedTools,
    maxTurns: sandboxEnabled && maxTurns < 3 ? 3 : maxTurns,
    systemPrompt,
    settingSources: ['user'],
    hooks: sdkHooks,
    ...(sandboxEnabled ? { sandbox: { enabled: true, autoAllowBashIfSandboxed: true }, env: buildSandboxEnv() } : {}),
    ...(sessionId ? { resume: sessionId } : {}),
  } satisfies Options;
}
