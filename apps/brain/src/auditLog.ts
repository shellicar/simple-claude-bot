import { accessSync, appendFileSync, constants } from 'node:fs';
import { join } from 'node:path';
import type { SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
import { logger } from '@simple-claude-bot/shared/logger';

let auditFilePath: string | undefined;

export function initAuditLog(dir: string): void {
  accessSync(dir, constants.W_OK);
  auditFilePath = join(dir, 'sdk-calls.jsonl');
  logger.info(`Audit log initialised: ${auditFilePath}`);
}

export function writeAuditEntry(endpoint: string, msg: SDKResultMessage): void {
  if (!auditFilePath) {
    logger.warn('Audit log not initialised, skipping entry');
    return;
  }
  try {
    const { result: _result, ...rest } = msg as SDKResultMessage & { result?: string };
    const entry = { timestamp: new Date().toISOString(), endpoint, ...rest };
    appendFileSync(auditFilePath, `${JSON.stringify(entry)}\n`);
    logger.info(`Audit entry written: endpoint=${endpoint} cost=$${msg.total_cost_usd.toFixed(4)} tokens=${msg.usage.input_tokens}in/${msg.usage.output_tokens}out`);
  } catch (error) {
    logger.error(`Failed to write audit entry: ${error}`);
  }
}
