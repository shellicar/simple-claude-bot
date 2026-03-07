import { app } from '@azure/functions';
import { logger } from '@simple-claude-bot/shared/logger';

logger.info('lifecycle: module loaded, registering hooks');

app.hook.appStart(() => {
  logger.info('appStart hook fired');
});

app.hook.appTerminate(() => {
  logger.info('appTerminate hook fired');
});
