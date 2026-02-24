import { app } from '@azure/functions';
import type { RespondResponse } from '@simple-claude-bot/shared/shared/types';

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
      const replies = await respondToMessages(audit, body, sandboxConfig);
      return {
        jsonBody: { replies } satisfies RespondResponse,
      };
    } catch (error) {
      return handleError('/respond', error, { replies: [] });
    }
  },
});
