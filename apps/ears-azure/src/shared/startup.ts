import { env } from 'node:process';
import { createEarsApp } from '@simple-claude-bot/ears-core/earsApp';
import { earsSchema } from '@simple-claude-bot/ears-core/earsSchema';
import { logger } from '@simple-claude-bot/shared/logger';

const controller = new AbortController();
const config = earsSchema.parse(env, { reportInput: true });

export const earsApp = createEarsApp(config, controller.signal);
export const shutdownController = controller;

logger.info('EarsApp initialized');
