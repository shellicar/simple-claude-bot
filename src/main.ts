import { Message, TextChannel } from 'discord.js';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { env } from 'node:process';
import { botSchema, discordSchema } from './schema.js';
import {
  compactSession,
  directQuery,
  initSessionPaths,
  resetSession,
  respondToMessages,
  sendUnprompted,
  type SandboxConfig,
} from './respondToMessage.js';
import { buildSystemPrompt } from './systemPrompts.js';
import { createDiscordClient } from './createDiscordClient.js';
import { logger } from './logger.js';

const main = async () => {
  logger.info('Starting simple-claude-bot...');

  let processing: Promise<void> | undefined;
  const messageQueue: Message[] = [];

  const { CLAUDE_CHANNEL, CLAUDE_CONFIG_DIR, DISCORD_GUILD, SANDBOX_ENABLED, SANDBOX_DIR, BOT_ALIASES } = botSchema.parse(env);

  const botAliases = BOT_ALIASES ? BOT_ALIASES.split(',').map((a) => a.trim()).filter(Boolean) : [];

  initSessionPaths(CLAUDE_CONFIG_DIR);

  const sandboxConfig: SandboxConfig = {
    enabled: SANDBOX_ENABLED === 'true',
    directory: resolve(SANDBOX_DIR),
  };

  mkdirSync(sandboxConfig.directory, { recursive: true });
  logger.info(`Sandbox ${sandboxConfig.enabled ? 'enabled' : 'disabled'} (cwd: ${sandboxConfig.directory})`);

  const client = createDiscordClient();
  let botChannel: TextChannel | undefined;
  let systemPrompt = buildSystemPrompt({ type: 'discord', sandbox: sandboxConfig.enabled, botAliases });

  const findChannel = (): TextChannel | undefined => {
    return client.channels.cache.find(
      (ch): ch is TextChannel =>
        ch instanceof TextChannel && ch.guild.id === DISCORD_GUILD && ch.name === CLAUDE_CHANNEL,
    );
  };

  const processQueue = async (channel: TextChannel) => {
    while (messageQueue.length > 0) {
      const batch = messageQueue.splice(0);
      await respondToMessages(batch, channel, systemPrompt, sandboxConfig);
    }
  };

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down...`);
    client.destroy();
    logger.info('Shutdown complete.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  client.once('ready', async () => {
    const botUserId = client.user?.id;
    const botUsername = client.user?.username;
    systemPrompt = buildSystemPrompt({ type: 'discord', sandbox: sandboxConfig.enabled, botUserId, botUsername, botAliases });
    logger.info(`Logged in as ${client.user?.tag} (${botUserId})`);
    logger.info(`Listening for messages in #${CLAUDE_CHANNEL}`);
    logger.debug(`System prompt: ${systemPrompt}`);
    botChannel = findChannel();
    if (botChannel) {
      logger.info(`Found channel #${botChannel.name} in guild ${botChannel.guild.name} (${botChannel.guild.id})`);
    } else {
      logger.warn(`Channel #${CLAUDE_CHANNEL} not found in guild ${DISCORD_GUILD}`);
    }
  });

  client.on('messageCreate', async (message: Message) => {
    if (message.author.bot) {
      return;
    }

    const channel = message.channel;
    if (
      !(channel instanceof TextChannel) ||
      channel.guild.id !== DISCORD_GUILD ||
      channel.name !== CLAUDE_CHANNEL
    ) {
      return;
    }

    logger.info(`${message.author.displayName}: ${message.content}`);
    messageQueue.push(message);

    if (processing) {
      return;
    }

    processing = processQueue(channel).finally(() => {
      processing = undefined;
    });
  });

  const rl = createInterface({ input: process.stdin });
  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    if (trimmed === '/shutdown') {
      logger.info('Shutdown command received');
      client.destroy();
      process.exit(0);
    }

    if (trimmed === '/prompt') {
      if (!botChannel) {
        logger.warn('Bot channel not found yet');
        return;
      }
      logger.info('Prompt command received');
      sendUnprompted(
        'Share a random interesting thought, fun fact, shower thought, or observation. Be concise and conversational.',
        botChannel,
        systemPrompt,
        sandboxConfig,
      );
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
      if (!botChannel) {
        logger.warn('Bot channel not found yet');
        return;
      }
      logger.info('Reset command received');
      resetSession(botChannel, systemPrompt, sandboxConfig).catch((error) => {
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

  const { DISCORD_TOKEN } = discordSchema.parse(env);
  client.login(DISCORD_TOKEN);
};

await main();
