import { Message, TextChannel } from 'discord.js';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { env } from 'node:process';
import { isBusy } from './isBusy.js';
import { botSchema, discordSchema } from './schema.js';
import { respondToMessage } from './respondToMessage.js';
import { createDiscordClient } from './createDiscordClient.js';

const LOCK_FILE = '.bot.lock';

const main = async () => {
  console.log('Starting simple-claude-bot...');

  const freshStart = !existsSync(LOCK_FILE);
  writeFileSync(LOCK_FILE, String(process.pid));

  let processing: Promise<void> | undefined;

  const { CLAUDE_CHANNEL } = botSchema.parse(env);

  const client = createDiscordClient();
  let botChannel: TextChannel | undefined;

  const findChannel = (): TextChannel | undefined => {
    return client.channels.cache.find(
      (ch): ch is TextChannel => ch instanceof TextChannel && ch.name === CLAUDE_CHANNEL,
    );
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

    const stillBusy = await isBusy(processing);
    if (stillBusy) {
      await message.react('\u23F3');
    } else {
      processing = respondToMessage(message, channel);
    }
  });

  const { DISCORD_TOKEN } = discordSchema.parse(env);
  client.login(DISCORD_TOKEN);
};

await main();
