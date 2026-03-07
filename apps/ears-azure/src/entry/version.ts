import { app } from '@azure/functions';
import { Version } from '@simple-claude-bot/shared/version';

app.http('version', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'version',
  handler: async () => {
    return {
      jsonBody: Version,
    };
  },
});
