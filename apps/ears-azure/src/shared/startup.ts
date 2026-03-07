import { env } from 'node:process';
import { createEarsApp } from '@simple-claude-bot/ears-core/earsApp';
import { earsSchema } from '@simple-claude-bot/ears-core/earsSchema';
import { logger } from '@simple-claude-bot/shared/logger';

const config = earsSchema.parse(env);

export const earsApp = createEarsApp(config);

logger.info('EarsApp initialized');
