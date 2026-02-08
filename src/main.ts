import { Message, TextChannel } from 'discord.js';
import { env } from 'node:process';
import { isBusy } from './isBusy.js';
import { claudeSchema, discordSchema } from './schema.js';
import { respondToMessage } from './respondToMessage.js';
import { createDiscordClient } from './createDiscordClient.js';
import { createClaudeClient } from './createClaudeClient.js';
import { ConversationState } from './ConversationState.js';

const main = async () => {
  let processing: Promise<void> | undefined;
  const state = ConversationState.load();

  const { ANTHROPIC_API_KEY, CLAUDE_CHANNEL } = claudeSchema.parse(env);
  const claude = createClaudeClient(ANTHROPIC_API_KEY);

  const client = createDiscordClient();

  client.once('ready', () => {
    console.log(`Logged in as ${client.user?.tag}`);
    console.log(`Listening for messages in #${CLAUDE_CHANNEL}`);
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
