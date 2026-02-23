import { app } from '@azure/functions';
import type { HealthResponse } from '@simple-claude-bot/shared/shared/types';

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: async () => {
    return {
      jsonBody: { status: 'ok' } satisfies HealthResponse,
    };
  },
});
