import { app } from '@azure/functions';
import { respondToMessages } from '@simple-claude-bot/brain-core/respondToMessages';
import { RespondRequestSchema } from '@simple-claude-bot/shared/shared/platform/schema';
import type { RespondResponse } from '@simple-claude-bot/shared/shared/types';
import { handleError, parseJsonBody } from '../shared/handleError';
import { audit, sandboxConfig } from '../shared/startup';

app.http('respond', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'respond',
  handler: async (request) => {
    try {
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
