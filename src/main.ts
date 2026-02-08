import { Message, TextChannel } from 'discord.js';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { env } from 'node:process';
import { botSchema, discordSchema } from './schema.js';
import { buildSystemPrompt, respondToMessages, sendUnprompted } from './respondToMessage.js';
import { createDiscordClient } from './createDiscordClient.js';
import { logger } from './logger.js';

const LOCK_FILE = '.bot.lock';

const main = async () => {
  logger.info('Starting simple-claude-bot...');

  const freshStart = !existsSync(LOCK_FILE);
  writeFileSync(LOCK_FILE, String(process.pid));

  let processing: Promise<void> | undefined;
  const messageQueue: Message[] = [];

  const { CLAUDE_CHANNEL, DISCORD_GUILD } = botSchema.parse(env);

  const client = createDiscordClient();
  let botChannel: TextChannel | undefined;
  let systemPrompt: string | undefined;

  const findChannel = (): TextChannel | undefined => {
    return client.channels.cache.find(
      (ch): ch is TextChannel =>
        ch instanceof TextChannel && ch.guild.id === DISCORD_GUILD && ch.name === CLAUDE_CHANNEL,
    );
  };

  const processQueue = async (channel: TextChannel) => {
    while (messageQueue.length > 0) {
      const batch = messageQueue.splice(0);
      await respondToMessages(batch, channel, systemPrompt ?? buildSystemPrompt(undefined, undefined));
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
    systemPrompt = buildSystemPrompt(botUserId, botUsername);
    logger.info(`Logged in as ${client.user?.tag} (${botUserId})`);
    logger.info(`Listening for messages in #${CLAUDE_CHANNEL}`);
    logger.debug(`System prompt: ${systemPrompt}`);
    botChannel = findChannel();
    if (botChannel) {
      logger.info(`Found channel #${botChannel.name} in guild ${botChannel.guild.name} (${botChannel.guild.id})`);
      if (freshStart) {
        await botChannel.send('Hello! I\'m online and ready to chat.');
      }
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
      if (botChannel) {
        botChannel.send('Goodbye! I\'m going offline now.').finally(() => {
          unlinkSync(LOCK_FILE);
          client.destroy();
          process.exit(0);
        });
      } else {
        unlinkSync(LOCK_FILE);
        client.destroy();
        process.exit(0);
      }
      return;
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
        systemPrompt ?? buildSystemPrompt(undefined, undefined),
      );
      return;
    }

    logger.warn(`Unknown command: ${trimmed}`);
  });

  const { DISCORD_TOKEN } = discordSchema.parse(env);
  client.login(DISCORD_TOKEN);
};

await main();
