import { Message, TextChannel } from 'discord.js';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { env } from 'node:process';
import { botSchema, discordSchema } from './schema.js';
import { respondToMessages } from './respondToMessage.js';
import { createDiscordClient } from './createDiscordClient.js';

const LOCK_FILE = '.bot.lock';

const main = async () => {
  console.log('Starting simple-claude-bot...');

  const freshStart = !existsSync(LOCK_FILE);
  writeFileSync(LOCK_FILE, String(process.pid));

  let processing: Promise<void> | undefined;
  const messageQueue: Message[] = [];

  const { CLAUDE_CHANNEL } = botSchema.parse(env);

  const client = createDiscordClient();
  let botChannel: TextChannel | undefined;

  const findChannel = (): TextChannel | undefined => {
    return client.channels.cache.find(
      (ch): ch is TextChannel => ch instanceof TextChannel && ch.name === CLAUDE_CHANNEL,
    );
  };

  const processQueue = async (channel: TextChannel) => {
    while (messageQueue.length > 0) {
      const batch = messageQueue.splice(0);
      await respondToMessages(batch, channel);
    }
  };

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down...`);
    client.destroy();
    console.log('Shutdown complete.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  client.once('ready', async () => {
    console.log(`Logged in as ${client.user?.tag}`);
    console.log(`Listening for messages in #${CLAUDE_CHANNEL}`);
    botChannel = findChannel();
    if (botChannel && freshStart) {
      await botChannel.send('Hello! I\'m online and ready to chat.');
    }
  });

  client.on('messageCreate', async (message: Message) => {
    if (message.author.bot) {
      return;
    }

    const channel = message.channel;
    if (!(channel instanceof TextChannel) || channel.name !== CLAUDE_CHANNEL) {
      return;
    }

    if (message.content === '/shutdown') {
      console.log('Shutdown command received');
      if (botChannel) {
        await botChannel.send('Goodbye! I\'m going offline now.');
      }
      unlinkSync(LOCK_FILE);
      client.destroy();
      process.exit(0);
    }

    console.log(`${message.author.displayName}: ${message.content}`);
    messageQueue.push(message);

    if (processing) {
      return;
    }

    processing = processQueue(channel).finally(() => {
      processing = undefined;
    });
  });

  const { DISCORD_TOKEN } = discordSchema.parse(env);
  client.login(DISCORD_TOKEN);
};

await main();
