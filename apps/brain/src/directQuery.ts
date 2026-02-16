import type { DirectRequest } from '@simple-claude-bot/shared/shared/types';
import type { AuditWriter } from './audit/auditLog';
import { buildQueryOptions } from './buildQueryOptions';
import { saveDirectSession } from './direct/saveDirectSession';
import { executeQuery } from './executeQuery';
import { claudeGlobals } from './globals';
import type { SandboxConfig } from './types';

export async function directQuery(audit: AuditWriter, body: DirectRequest, sandboxConfig: SandboxConfig): Promise<string> {
  const options = buildQueryOptions({
    systemPrompt: body.systemPrompt,
    allowedTools: body.allowedTools,
    maxTurns: 25,
    sandboxConfig,
    sessionId: claudeGlobals.directSessionId,
  });

  return executeQuery(audit, '/direct', body.prompt, options, saveDirectSession);
}
