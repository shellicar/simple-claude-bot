import { app } from '@azure/functions';
import type { SessionResponse } from '@simple-claude-bot/shared/shared/types';

app.http('session-get', {
  methods: ['GET'],
  authLevel: 'function',
  route: 'session',
  handler: async () => {
    const { getSessionId } = await import('@simple-claude-bot/brain-core/getSessionId');
    const sessionId = getSessionId() ?? null;
    return {
      jsonBody: { sessionId } satisfies SessionResponse,
    };
  },
});

app.http('session-set', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'session',
  handler: async (request) => {
    const { handleError, parseJsonBody } = await import('../shared/handleError');
    try {
      const { setSessionId } = await import('@simple-claude-bot/brain-core/session/setSessionId');
      const { SessionSetRequestSchema } = await import('@simple-claude-bot/shared/shared/platform/schema');
      const { sessionId } = SessionSetRequestSchema.parse(await parseJsonBody(request));
      setSessionId(sessionId);
      return {
        jsonBody: { sessionId } satisfies SessionResponse,
      };
    } catch (error) {
      return handleError('/session', error, { sessionId: null });
    }
  },
});
