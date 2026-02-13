import { createInterface } from 'node:readline';
import { setTimeout } from 'node:timers/promises';
import versionInfo from '@shellicar/build-version/version';
import { logger } from '@simple-claude-bot/shared/logger';
import type { PlatformMessage } from '@simple-claude-bot/shared/shared/platform/types';
import type { PlatformChannel } from './platform/types';
import type { ParsedReply } from '@simple-claude-bot/shared/shared/types';
import { earsSchema } from './earsSchema';
import { resetActivity, seedActivity, startWorkPlay, stopWorkPlay, triggerWorkPlay } from './workplay.js';
import { BrainClient } from './brainClient';
import { startDiscord } from './platform/discord/startDiscord';
import { buildSystemPrompt } from './systemPrompts';

const main = async () => {
  logger.info(`Starting ears v${versionInfo.version} (${versionInfo.shortSha}) built ${versionInfo.buildDate}`);

  let processing: Promise<void> | undefined;
  const messageQueue: PlatformMessage[] = [];

  const { DISCORD_TOKEN, DISCORD_GUILD, CLAUDE_CHANNEL, BOT_ALIASES, BRAIN_URL, SANDBOX_ENABLED, SANDBOX_COMMANDS } = earsSchema.parse(process.env);

  const brain = new BrainClient(BRAIN_URL);
  const sandboxEnabled = SANDBOX_ENABLED === 'true';

  const botAliases = BOT_ALIASES
    ? BOT_ALIASES.split(',')
        .map((a) => a.trim())
        .filter(Boolean)
    : [];

  let platformChannel: PlatformChannel | undefined;
  let systemPrompt = buildSystemPrompt({ type: 'discord', sandbox: sandboxEnabled, sandboxCommands: SANDBOX_COMMANDS, botAliases });

  async function dispatchReplies(channel: PlatformChannel, replies: ParsedReply[], messages?: PlatformMessage[]): Promise<void> {
    const messagesByUserId = new Map<string, PlatformMessage>();
    if (messages) {
      for (const m of messages) {
        messagesByUserId.set(m.authorId, m);
      }
    }

    for (const reply of replies) {
      if (reply.delay) {
        logger.debug(`Delaying ${reply.delay}ms before next message`);
        await setTimeout(reply.delay);
      }

      const target = reply.replyTo && reply.ping ? messagesByUserId.get(reply.replyTo) : undefined;

      if (target) {
        await channel.replyTo(target, reply.message);
      } else {
        await channel.sendMessage(reply.message);
      }
    }
  }

  function startTyping(channel: PlatformChannel): () => void {
    logger.debug('Typing: started');
    channel.sendTyping();
    const timer = setInterval(() => {
      logger.debug('Typing: refresh');
      channel.sendTyping();
    }, 5000);
    return () => {
      clearInterval(timer);
      logger.debug('Typing: stopped');
    };
  }

  const processQueue = async (channel: PlatformChannel) => {
    while (messageQueue.length > 0) {
      const batch = messageQueue.splice(0);
      for (const m of batch) {
        channel.trackMessage(m);
      }

      const stopTyping = startTyping(channel);
      try {
        const response = await brain.respond({ messages: batch, systemPrompt });

        if (response.error) {
          logger.error(`Brain respond error: ${response.error}`);
          await channel.sendMessage('Sorry, I encountered an error processing your message.');
        } else if (response.replies.length === 0) {
          logger.debug('No replies to send');
        } else {
          await dispatchReplies(channel, response.replies, batch);
        }
      } catch (error) {
        logger.error(`Error processing message: ${error}`);
        await channel.sendMessage('Sorry, I encountered an error processing your message.');
      } finally {
        stopTyping();
      }

      channel.clearTracked();
    }
  };

  const handle = startDiscord({ guildId: DISCORD_GUILD, channelName: CLAUDE_CHANNEL }, DISCORD_TOKEN, {
    onReady: (info) => {
      systemPrompt = buildSystemPrompt({ type: 'discord', sandbox: sandboxEnabled, sandboxCommands: SANDBOX_COMMANDS, botUserId: info.botUserId, botUsername: info.botUsername, botAliases });
      logger.debug(`System prompt: ${systemPrompt}`);
      platformChannel = info.channel;
      if (info.lastMessageTimestamp) {
        seedActivity(info.lastMessageTimestamp);
      }
      startWorkPlay({
        sandboxEnabled,
        onIdle: async (prompt, options) => {
          const response = await brain.unprompted({ prompt, systemPrompt, allowedTools: options.allowedTools, maxTurns: options.maxTurns });
          if (response.spoke && response.replies.length > 0 && platformChannel) {
            await dispatchReplies(platformChannel, response.replies);
          }
          return { replies: response.replies, spoke: response.spoke };
        },
        isProcessing: () => processing !== undefined,
        setProcessing: (p) => {
          processing = p.finally(() => {
            processing = undefined;
          });
        },
        setPresence: (status) => handle.setPresence(status),
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
    if (!trimmed) {
      return;
    }

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
      if (processing) {
        logger.warn('Busy — ignoring /prompt');
        return;
      }
      logger.info('Prompt command received');
      processing = brain
        .unprompted({ prompt: 'Share a random interesting thought, fun fact, shower thought, or observation. Be concise and conversational.', systemPrompt })
        .then(
          async (response) => {
            if (response.spoke && response.replies.length > 0 && platformChannel) {
              await dispatchReplies(platformChannel, response.replies);
            }
          },
          (error) => {
            logger.error(`Prompt error: ${error}`);
          },
        )
        .finally(() => {
          processing = undefined;
        });
      return;
    }

    if (trimmed === '/compact') {
      if (processing) {
        logger.warn('Busy — ignoring /compact');
        return;
      }
      logger.info('Compact command received');
      processing = brain
        .compact()
        .then(
          (response) => {
            if (response.error) {
              logger.error(`Compact error: ${response.error}`);
            } else {
              logger.info(`Compact result: ${response.result}`);
            }
          },
          (error) => {
            logger.error(`Compact error: ${error}`);
          },
        )
        .finally(() => {
          processing = undefined;
        });
      return;
    }

    if (trimmed === '/reset') {
      if (!platformChannel) {
        logger.warn('Bot channel not found yet');
        return;
      }
      if (processing) {
        logger.warn('Busy — ignoring /reset');
        return;
      }
      logger.info('Reset command received');
      processing = platformChannel
        .fetchHistory(500)
        .then(
          async (messages) => {
            try {
              const response = await brain.reset({ messages, systemPrompt });
              if (response.error) {
                logger.error(`Reset error: ${response.error}`);
              } else {
                logger.info(`Reset result: ${response.result}`);
              }
            } catch (error) {
              logger.error(`Reset error: ${error}`);
            }
          },
          (error) => {
            logger.error(`Reset fetch history error: ${error}`);
          },
        )
        .finally(() => {
          processing = undefined;
        });
      return;
    }

    if (trimmed === '/health') {
      logger.info('Health check command received');
      brain.health().then(
        (response) => {
          logger.info(`Health: ${response.status}`);
        },
        (error) => {
          logger.error(`Health check error: ${error}`);
        },
      );
      return;
    }

    if (trimmed === '/ping') {
      if (processing) {
        logger.warn('Busy — ignoring /ping');
        return;
      }
      logger.info('Ping command received');
      processing = brain
        .ping()
        .then(
          (response) => {
            if (response.error) {
              logger.error(`Ping error: ${response.error}`);
            } else {
              logger.info(`Ping response: ${response.result}`);
            }
          },
          (error) => {
            logger.error(`Ping error: ${error}`);
          },
        )
        .finally(() => {
          processing = undefined;
        });
      return;
    }

    if (trimmed.startsWith('/direct ')) {
      const prompt = trimmed.slice('/direct '.length).trim();
      if (!prompt) {
        logger.warn('No prompt provided for /direct');
        return;
      }
      if (processing) {
        logger.warn('Busy — ignoring /direct');
        return;
      }
      logger.info(`Direct query: ${prompt}`);
      processing = brain
        .direct({ prompt, systemPrompt: buildSystemPrompt({ type: 'direct' }) })
        .then(
          (response) => {
            if (response.error) {
              logger.error(`Direct query error: ${response.error}`);
            } else {
              logger.info(`Direct response: ${response.result}`);
            }
          },
          (error) => {
            logger.error(`Direct query error: ${error}`);
          },
        )
        .finally(() => {
          processing = undefined;
        });
      return;
    }

    logger.warn(`Unknown command: ${trimmed}`);
  });
};

await main();
