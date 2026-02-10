import { type Message, TextChannel } from 'discord.js';
import { createDiscordClient } from '../../createDiscordClient.js';
import { logger } from '../../logger.js';
import type { PlatformChannel, PlatformMessage } from '../types.js';
import { DiscordChannel } from './DiscordChannel.js';
import { DiscordMessage } from './DiscordMessage.js';

export interface DiscordConfig {
  readonly guildId: string;
  readonly channelName: string;
}

export interface DiscordReadyInfo {
  readonly channel: PlatformChannel;
  readonly botUserId?: string;
  readonly botUsername?: string;
  readonly lastMessageTimestamp?: number;
}

export interface DiscordHandle {
  destroy(): void;
}

export function startDiscord(
  config: DiscordConfig,
  token: string,
  callbacks: {
    onReady: (info: DiscordReadyInfo) => void;
    onMessage: (message: PlatformMessage) => void;
  },
): DiscordHandle {
  const client = createDiscordClient();

  client.once('ready', async () => {
    const botUserId = client.user?.id;
    const botUsername = client.user?.username;
    logger.info(`Logged in as ${client.user?.tag} (${botUserId})`);
    logger.info(`Listening for messages in #${config.channelName}`);

    const botChannel = client.channels.cache.find((ch): ch is TextChannel => ch instanceof TextChannel && ch.guild.id === config.guildId && ch.name === config.channelName);

    if (!botChannel) {
      logger.warn(`Channel #${config.channelName} not found in guild ${config.guildId}`);
      return;
    }

    const channel = new DiscordChannel(botChannel);
    logger.info(`Found channel #${botChannel.name} in guild ${botChannel.guild.name} (${botChannel.guild.id})`);

    let lastMessageTimestamp: number | undefined;
    const lastMessage = (await botChannel.messages.fetch({ limit: 1 })).first();
    if (lastMessage) {
      lastMessageTimestamp = lastMessage.createdTimestamp;
      logger.info(`Seeded activity from last message at ${new Date(lastMessageTimestamp).toISOString()}`);
    }

    callbacks.onReady({ channel, botUserId, botUsername, lastMessageTimestamp });
  });

  client.on('messageCreate', (message: Message) => {
    if (message.author.bot) {
      logger.debug(`Filtered bot message: author=${message.author.displayName} (${message.author.id}) bot=${message.author.bot} webhook=${message.webhookId ?? 'none'} channel=${message.channel.id}`);
      return;
    }

    const ch = message.channel;
    if (!(ch instanceof TextChannel) || ch.guild.id !== config.guildId || ch.name !== config.channelName) {
      return;
    }

    logger.info(`${message.author.displayName}: ${message.content}`);
    callbacks.onMessage(new DiscordMessage(message));
  });

  client.login(token);

  return {
    destroy: () => client.destroy(),
  };
}
