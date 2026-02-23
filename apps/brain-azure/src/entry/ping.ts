import { app } from '@azure/functions';
import type { PingResponse } from '@simple-claude-bot/shared/shared/types';

app.http('ping', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'ping',
  handler: async () => {
    const { handleError } = await import('../shared/handleError');
    try {
      const { audit, sandboxConfig } = await import('../shared/startup');
      const { pingSDK } = await import('@simple-claude-bot/brain-core/ping/pingSDK');
      const result = await pingSDK(audit, sandboxConfig);
      return {
        jsonBody: { result } satisfies PingResponse,
      };
    } catch (error) {
      return handleError('/ping', error, { result: '' });
    }
  },
});
