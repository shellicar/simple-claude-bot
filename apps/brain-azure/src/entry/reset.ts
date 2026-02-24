import { app } from '@azure/functions';
import type { ResetResponse } from '@simple-claude-bot/shared/shared/types';

app.http('reset', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'reset',
  handler: async (request) => {
    const { handleError, parseJsonBody } = await import('../shared/handleError');
    try {
      const { audit, sandboxConfig } = await import('../shared/startup');
      const { resetSession } = await import('@simple-claude-bot/brain-core/session/resetSession');
      const { ResetRequestSchema } = await import('@simple-claude-bot/shared/shared/platform/schema');
      const body = ResetRequestSchema.parse(await parseJsonBody(request));
      const result = await resetSession(audit, body, sandboxConfig);
      return {
        jsonBody: { result } satisfies ResetResponse,
      };
    } catch (error) {
      return handleError('/reset', error, { result: '' });
    }
  },
});
