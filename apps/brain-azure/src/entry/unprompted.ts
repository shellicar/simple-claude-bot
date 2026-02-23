import { app } from '@azure/functions';
import type { UnpromptedResponse } from '@simple-claude-bot/shared/shared/types';

app.http('unprompted', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'unprompted',
  handler: async (request) => {
    const { handleError, parseJsonBody } = await import('../shared/handleError');
    try {
      const { audit, sandboxConfig } = await import('../shared/startup');
      const { sendUnprompted } = await import('@simple-claude-bot/brain-core/unsolicited/sendUnprompted');
      const { UnpromptedRequestSchema } = await import('@simple-claude-bot/shared/shared/platform/schema');
      const body = UnpromptedRequestSchema.parse(await parseJsonBody(request));
      const { replies, spoke } = await sendUnprompted(audit, body, sandboxConfig);
      return {
        jsonBody: { replies, spoke } satisfies UnpromptedResponse,
      };
    } catch (error) {
      return handleError('/unprompted', error, { replies: [], spoke: false });
    }
  },
});
