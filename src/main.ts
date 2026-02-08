import { Message, TextChannel } from 'discord.js';
import { env } from 'node:process';
import { isBusy } from './isBusy.js';
import { claudeSchema, discordSchema } from './schema.js';
import { respondToMessage } from './respondToMessage.js';
import { createDiscordClient } from './createDiscordClient.js';
import { createClaudeClient } from './createClaudeClient.js';
import { ConversationState } from './ConversationState.js';

const main = async () => {
  console.log('Starting simple-claude-bot...');

  let processing: Promise<void> | undefined;
  const state = ConversationState.load();

  const { ANTHROPIC_API_KEY, CLAUDE_CHANNEL } = claudeSchema.parse(env);
  const claude = createClaudeClient(ANTHROPIC_API_KEY);

  const client = createDiscordClient();
  let botChannel: TextChannel | undefined;

  const findChannel = (): TextChannel | undefined => {
    return client.channels.cache.find(
      (ch): ch is TextChannel => ch instanceof TextChannel && ch.name === CLAUDE_CHANNEL,
    );
  };

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down...`);
    if (botChannel) {
      await botChannel.send('Goodbye! I\'m going offline now.').catch(() => {});
    }
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
    if (botChannel) {
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

    console.log(`${message.author.displayName}: ${message.content}`);
    state.addUserMessage(`${message.author.displayName}: ${message.content}`);

    const stillBusy = await isBusy(processing);
    if (stillBusy) {
      await message.react('⏳');
    } else {
      processing = respondToMessage(message, channel, claude, state);
    }
  });

  const { DISCORD_TOKEN } = discordSchema.parse(env);
  client.login(DISCORD_TOKEN);
};

await main();
