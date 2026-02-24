import { app } from '@azure/functions';
import type { CompactResponse } from '@simple-claude-bot/shared/shared/types';

app.http('compact', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'compact',
  handler: async (request) => {
    const { handleError, parseJsonBody } = await import('../shared/handleError');
    try {
      const { audit, sandboxConfig } = await import('../shared/startup');
      const { compactSession } = await import('@simple-claude-bot/brain-core/compactSession');
      const { CompactRequestSchema } = await import('@simple-claude-bot/shared/shared/platform/schema');
      const body = CompactRequestSchema.parse(await parseJsonBody(request));
      const result = await compactSession(audit, sandboxConfig, body.resumeSessionAt);
      return {
        jsonBody: { result } satisfies CompactResponse,
      };
    } catch (error) {
      return handleError('/compact', error, { result: '' });
    }
  },
});
