import { app } from '@azure/functions';
import { logger } from '@simple-claude-bot/shared/logger';

logger.info('lifecycle: module loaded, registering hooks and signal handlers');

app.hook.appStart(() => {
  logger.info('appStart hook fired');
});

app.hook.appTerminate(() => {
  logger.info('appTerminate hook fired');
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    logger.info(`Received ${signal}, shutting down...`);
    process.exit(0);
  });
}
