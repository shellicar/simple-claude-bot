import { logger } from '@simple-claude-bot/shared/logger';

export const createShutdownController = (): AbortSignal => {
  const controller = new AbortController();

  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    logger.warn(`Received ${signal}, starting graceful shutdown`);

    controller.abort();

    setTimeout(() => {
      logger.error('Graceful shutdown timeout, forcing exit');
      process.exit(1);
    }, 5_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return controller.signal;
};
