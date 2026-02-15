import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { logger } from '@simple-claude-bot/shared/logger';
import type { ParsedReply, RespondRequest } from '@simple-claude-bot/shared/shared/types';
import { buildContentBlocks } from './buildContentBlocks';
import { buildQueryOptions } from './buildQueryOptions';
import { executeQuery } from './executeQuery';
import { claudeGlobals } from './globals';
import { parseResponse } from './parseResponse';
import { saveSession } from './session/saveSession';
import type { SandboxConfig } from './types';

export async function respondToMessages(body: RespondRequest, sandboxConfig: SandboxConfig): Promise<ParsedReply[]> {
  const contentBlocks = buildContentBlocks(body.messages);
  const hasImages = contentBlocks.some((b) => b.type === 'image');

  const promptText = contentBlocks
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  logger.info(`Prompt: ${promptText}`);

  const prompt = hasImages
    ? (async function* () {
        yield {
          type: 'user',
          message: {
            role: 'user',
            content: contentBlocks,
          },
          parent_tool_use_id: null,
          session_id: claudeGlobals.sessionId ?? '',
        } satisfies SDKUserMessage;
      })()
    : promptText;

  const options = buildQueryOptions({
    systemPrompt: body.systemPrompt,
    allowedTools: body.allowedTools,
    maxTurns: 25,
    sandboxConfig,
    sessionId: claudeGlobals.sessionId,
  });

  const result = await executeQuery('/respond', prompt, options, saveSession);

  if (!result) {
    logger.warn('Empty response from Claude');
    return [];
  }

  return parseResponse(result);
}
