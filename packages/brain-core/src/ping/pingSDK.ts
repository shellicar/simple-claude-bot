import type { AuditWriter } from '../audit/auditLog';
import { buildQueryOptions } from '../buildQueryOptions';
import { executeQuery } from '../executeQuery';
import type { SandboxConfig } from '../types';

export async function pingSDK(audit: AuditWriter, sandboxConfig: SandboxConfig): Promise<string> {
  const options = buildQueryOptions({
    systemPrompt: 'Respond with exactly: pong',
    allowedTools: [],
    maxTurns: 1,
    sandboxConfig,
  });

  return executeQuery(audit, '/ping', 'ping', options, () => {});
}
