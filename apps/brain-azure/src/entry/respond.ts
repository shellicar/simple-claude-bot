import { app } from '@azure/functions';
import { logger } from '@simple-claude-bot/shared/logger';
import type { CallbackPayload, RespondResponse } from '@simple-claude-bot/shared/shared/types';

async function postCallback(url: string, payload: CallbackPayload): Promise<void> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      logger.warn(`Callback to ${url} failed with status ${response.status}`);
    }
  } catch (error) {
    logger.warn(`Callback to ${url} failed: ${error}`);
  }
}

app.http('respond', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'respond',
  handler: async (request) => {
    const { handleError, parseJsonBody } = await import('../shared/handleError');
    try {
      const { audit, sandboxConfig } = await import('../shared/startup');
      const { respondToMessages } = await import('@simple-claude-bot/brain-core/respondToMessages');
      const { RespondRequestSchema } = await import('@simple-claude-bot/shared/shared/platform/schema');
      const body = RespondRequestSchema.parse(await parseJsonBody(request));

      if (body.callbackUrl) {
        // Async mode: return 202 immediately, process in background
        const callbackUrl = body.callbackUrl;

        // Fire and forget — process in background
        (async () => {
          await postCallback(callbackUrl, { type: 'typing' });

          const typingInterval = setInterval(() => {
            postCallback(callbackUrl, { type: 'typing' });
          }, 8000);

          try {
            const replies = await respondToMessages(audit, body, sandboxConfig);
            await postCallback(callbackUrl, { type: 'message', replies });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Background processing failed: ${errorMessage}`);
            await postCallback(callbackUrl, {
              type: 'message',
              replies: [{ message: `⚠️ Something went wrong: ${errorMessage}` }],
            });
          } finally {
            clearInterval(typingInterval);
          }
        })().catch((error) => {
          logger.error(`Unhandled error in background processing: ${error}`);
        });

        return { status: 202 };
      }

      // Sync mode: existing behavior (backward compatible)
      const replies = await respondToMessages(audit, body, sandboxConfig);
      return {
        jsonBody: { replies } satisfies RespondResponse,
      };
    } catch (error) {
      return handleError('/respond', error, { replies: [] });
    }
  },
});
