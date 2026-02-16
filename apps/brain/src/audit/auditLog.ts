import { accessSync, appendFileSync, constants } from 'node:fs';
import { join } from 'node:path';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { logger } from '@simple-claude-bot/shared/logger';

export class AuditWriter {
  private readonly auditFilePath: string;

  public constructor(dir: string) {
    accessSync(dir, constants.W_OK);
    this.auditFilePath = join(dir, 'sdk-events.jsonl');
    logger.info(`Audit log initialised: ${this.auditFilePath}`);
  }

  public write(endpoint: string, msg: SDKMessage): void {
    const entry = { timestamp: new Date().toISOString(), endpoint, ...msg };
    appendFileSync(this.auditFilePath, `${JSON.stringify(entry)}\n`);
  }
}
