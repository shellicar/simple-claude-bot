import type { DirectRequest } from '@simple-claude-bot/shared/shared/types';
import { buildQueryOptions } from './buildQueryOptions';
import { saveDirectSession } from './direct/saveDirectSession';
import { executeQuery } from './executeQuery';
import { claudeGlobals } from './globals';
import type { SandboxConfig } from './types';

export async function directQuery(body: DirectRequest, sandboxConfig: SandboxConfig): Promise<string> {
  const options = buildQueryOptions({
    systemPrompt: body.systemPrompt,
    allowedTools: body.allowedTools,
    maxTurns: 25,
    sandboxConfig,
    sessionId: claudeGlobals.directSessionId,
  });

  return executeQuery('/direct', body.prompt, options, saveDirectSession);
}
