import { app } from '@azure/functions';
import versionInfo from '@shellicar/build-version/version';
import type { VersionResponse } from '@simple-claude-bot/shared/shared/types';

app.http('version', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'version',
  handler: async () => {
    return {
      jsonBody: {
        version: versionInfo.version,
        shortSha: versionInfo.shortSha,
        buildDate: versionInfo.buildDate,
      } satisfies VersionResponse,
    };
  },
});
