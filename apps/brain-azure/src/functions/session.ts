import { app } from '@azure/functions';
import { getSessionId } from '@simple-claude-bot/brain-core/getSessionId';
import { setSessionId } from '@simple-claude-bot/brain-core/session/setSessionId';
import { SessionSetRequestSchema } from '@simple-claude-bot/shared/shared/platform/schema';
import type { SessionResponse } from '@simple-claude-bot/shared/shared/types';
import { handleError, parseJsonBody } from '../shared/handleError';

app.http('session-get', {
  methods: ['GET'],
  authLevel: 'function',
  route: 'session',
  handler: async () => {
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
    try {
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
