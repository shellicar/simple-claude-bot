import { app } from '@azure/functions';
import { logger } from '@simple-claude-bot/shared/logger';
import { earsApp } from '../shared/startup';

logger.info('lifecycle: module loaded, registering hooks and signal handlers');

app.hook.appStart(() => {
  logger.info('appStart hook fired');
});

app.hook.appTerminate(() => {
  logger.info('appTerminate hook fired');
  earsApp.shutdown();
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    logger.info(`Received ${signal}, shutting down...`);
    earsApp.shutdown();
    process.exit(0);
  });
}
