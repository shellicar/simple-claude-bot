import { accessSync, appendFileSync, constants } from 'node:fs';
import { join } from 'node:path';
import { logger } from '@simple-claude-bot/shared/logger';

let auditFilePath: string | undefined;

export function initAuditLog(dir: string): void {
  accessSync(dir, constants.W_OK);
  auditFilePath = join(dir, 'sdk-calls.jsonl');
  logger.info(`Audit log initialised: ${auditFilePath}`);
}

export type AuditEntry = {
  timestamp: string;
  endpoint: string;
  sessionId: string | undefined;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  turns: number;
  durationMs: number;
  model: string;
};

export function writeAuditEntry(entry: AuditEntry): void {
  if (!auditFilePath) {
    logger.warn('Audit log not initialised, skipping entry');
    return;
  }
  try {
    appendFileSync(auditFilePath, `${JSON.stringify(entry)}\n`);
    logger.info(`Audit entry written: endpoint=${entry.endpoint} cost=$${entry.costUsd.toFixed(4)} tokens=${entry.inputTokens}in/${entry.outputTokens}out`);
  } catch (error) {
    logger.error(`Failed to write audit entry: ${error}`);
  }
}
