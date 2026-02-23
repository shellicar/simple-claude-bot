import { app } from '@azure/functions';
import type { DirectResponse } from '@simple-claude-bot/shared/shared/types';

app.http('direct', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'direct',
  handler: async (request) => {
    const { handleError, parseJsonBody } = await import('../shared/handleError');
    try {
      const { audit, sandboxConfig } = await import('../shared/startup');
      const { directQuery } = await import('@simple-claude-bot/brain-core/directQuery');
      const { DirectRequestSchema } = await import('@simple-claude-bot/shared/shared/platform/schema');
      const body = DirectRequestSchema.parse(await parseJsonBody(request));
      const result = await directQuery(audit, body, sandboxConfig);
      return {
        jsonBody: { result } satisfies DirectResponse,
      };
    } catch (error) {
      return handleError('/direct', error, { result: '' });
    }
  },
});
