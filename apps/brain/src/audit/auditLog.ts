import { accessSync, appendFileSync, constants } from 'node:fs';
import { join } from 'node:path';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { logger } from '@simple-claude-bot/shared/logger';

let auditFilePath: string | undefined;

export function initAuditLog(dir: string): void {
  accessSync(dir, constants.W_OK);
  auditFilePath = join(dir, 'sdk-events.jsonl');
  logger.info(`Audit log initialised: ${auditFilePath}`);
}

export function writeAuditEvent(endpoint: string, msg: SDKMessage): void {
  if (!auditFilePath) {
    throw new Error('Audit log not initialised');
  }
  const entry = { timestamp: new Date().toISOString(), endpoint, ...msg };
  appendFileSync(auditFilePath, `${JSON.stringify(entry)}\n`);
}
