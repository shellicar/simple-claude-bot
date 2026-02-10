import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { env } from 'node:process';
import { createInterface } from 'node:readline';
import versionInfo from '@shellicar/build-version/version';
import { logger } from './logger.js';
import { startDiscord } from './platform/discord/startDiscord.js';
import type { PlatformChannel, PlatformMessage } from './platform/types.js';
import { compactSession, directQuery, initSessionPaths, resetSession, respondToMessages, type SandboxConfig, sendUnprompted } from './respondToMessage.js';
import { botSchema, discordSchema } from './schema.js';
import { buildSystemPrompt } from './systemPrompts.js';
import { resetActivity, seedActivity, startWorkPlay, stopWorkPlay, triggerWorkPlay } from './workplay.js';

const main = async () => {
  logger.info(`Starting simple-claude-bot v${versionInfo.version} (${versionInfo.shortSha}) built ${versionInfo.buildDate}`);

  let processing: Promise<void> | undefined;
  const messageQueue: PlatformMessage[] = [];

  const { CLAUDE_CHANNEL, CLAUDE_CONFIG_DIR, DISCORD_GUILD, SANDBOX_ENABLED, SANDBOX_DIR, BOT_ALIASES, SANDBOX_COMMANDS } = botSchema.parse(env);
  const { DISCORD_TOKEN } = discordSchema.parse(env);

  const botAliases = BOT_ALIASES
    ? BOT_ALIASES.split(',')
        .map((a) => a.trim())
        .filter(Boolean)
    : [];

  initSessionPaths(CLAUDE_CONFIG_DIR);

  const sandboxConfig: SandboxConfig = {
    enabled: SANDBOX_ENABLED === 'true',
    directory: resolve(SANDBOX_DIR),
  };

  mkdirSync(sandboxConfig.directory, { recursive: true });
  logger.info(`Sandbox ${sandboxConfig.enabled ? 'enabled' : 'disabled'} (cwd: ${sandboxConfig.directory})`);

  let platformChannel: PlatformChannel | undefined;
  let systemPrompt = buildSystemPrompt({ type: 'discord', sandbox: sandboxConfig.enabled, sandboxCommands: SANDBOX_COMMANDS, botAliases });

  const processQueue = async (channel: PlatformChannel) => {
    while (messageQueue.length > 0) {
      const batch = messageQueue.splice(0);
      for (const m of batch) {
        channel.trackMessage(m);
      }
      await respondToMessages(batch, channel, systemPrompt, sandboxConfig);
      channel.clearTracked();
    }
  };

  const handle = startDiscord({ guildId: DISCORD_GUILD, channelName: CLAUDE_CHANNEL }, DISCORD_TOKEN, {
    onReady: (info) => {
      systemPrompt = buildSystemPrompt({ type: 'discord', sandbox: sandboxConfig.enabled, botUserId: info.botUserId, botUsername: info.botUsername, botAliases });
      logger.debug(`System prompt: ${systemPrompt}`);
      platformChannel = info.channel;
      if (info.lastMessageTimestamp) {
        seedActivity(info.lastMessageTimestamp);
      }
      startWorkPlay({
        channel: info.channel,
        systemPrompt,
        sandboxConfig,
        isProcessing: () => processing !== undefined,
        setProcessing: (p) => {
          processing = p.finally(() => {
            processing = undefined;
          });
        },
      });
    },
    onMessage: (message) => {
      resetActivity();
      messageQueue.push(message);
      if (processing || !platformChannel) {
        return;
      }
      processing = processQueue(platformChannel).finally(() => {
        processing = undefined;
        resetActivity();
      });
    },
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down...`);
    stopWorkPlay();
    handle.destroy();
    logger.info('Shutdown complete.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  const rl = createInterface({ input: process.stdin });
  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    if (trimmed === '/shutdown') {
      logger.info('Shutdown command received');
      stopWorkPlay();
      handle.destroy();
      process.exit(0);
    }

    if (trimmed === '/version') {
      logger.info(`v${versionInfo.version} (${versionInfo.shortSha}) built ${versionInfo.buildDate}`);
      return;
    }

    if (trimmed === '/workplay') {
      logger.info('WorkPlay manual trigger received');
      triggerWorkPlay();
      return;
    }

    if (trimmed === '/prompt') {
      if (!platformChannel) {
        logger.warn('Bot channel not found yet');
        return;
      }
      logger.info('Prompt command received');
      sendUnprompted('Share a random interesting thought, fun fact, shower thought, or observation. Be concise and conversational.', platformChannel, systemPrompt, sandboxConfig);
      return;
    }

    if (trimmed === '/compact') {
      logger.info('Compact command received');
      compactSession().catch((error) => {
        logger.error(`Compact error: ${error}`);
      });
      return;
    }

    if (trimmed === '/reset') {
      if (!platformChannel) {
        logger.warn('Bot channel not found yet');
        return;
      }
      logger.info('Reset command received');
      resetSession(platformChannel, systemPrompt, sandboxConfig).catch((error) => {
        logger.error(`Reset error: ${error}`);
      });
      return;
    }

    if (trimmed.startsWith('/direct ')) {
      const prompt = trimmed.slice('/direct '.length).trim();
      if (!prompt) {
        logger.warn('No prompt provided for /direct');
        return;
      }
      logger.info(`Direct query: ${prompt}`);
      directQuery(prompt, sandboxConfig).then(
        (result) => {
          console.log(`\n--- Direct Response ---\n${result}\n--- End ---\n`);
        },
        (error) => {
          logger.error(`Direct query error: ${error}`);
        },
      );
      return;
    }

    logger.warn(`Unknown command: ${trimmed}`);
  });
};

await main();
