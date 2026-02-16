import { logger } from '@simple-claude-bot/shared/logger';
import type { ParsedReply, UnpromptedRequest } from '@simple-claude-bot/shared/shared/types';
import type { AuditWriter } from '../audit/auditLog';
import { buildQueryOptions } from '../buildQueryOptions';
import { executeQuery } from '../executeQuery';
import { claudeGlobals } from '../globals';
import { parseResponse } from '../parseResponse';
import { saveSession } from '../session/saveSession';
import type { SandboxConfig } from '../types';

export async function sendUnprompted(audit: AuditWriter, body: UnpromptedRequest, sandboxConfig: SandboxConfig): Promise<{ replies: ParsedReply[]; spoke: boolean }> {
  try {
    logger.info(`Unprompted: ${body.prompt}`);

    const sdkOptions = buildQueryOptions({
      systemPrompt: body.systemPrompt,
      allowedTools: body.allowedTools ?? [],
      maxTurns: body.maxTurns ?? 1,
      sandboxConfig,
      sessionId: claudeGlobals.sessionId,
    });

    const result = await executeQuery(audit, '/unprompted', body.prompt, sdkOptions, saveSession);

    if (!result) {
      logger.warn('Empty unprompted response');
      return { replies: [], spoke: false };
    }

    const replies = parseResponse(result);
    return { replies, spoke: replies.length > 0 };
  } catch (error) {
    logger.error(`Error in unprompted message: ${error}`);
    return { replies: [], spoke: false };
  }
}
