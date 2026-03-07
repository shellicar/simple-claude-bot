import { setTimeout } from 'node:timers/promises';
import { logger } from '@simple-claude-bot/shared/logger';
import type { CallbackResponse, Reply } from '@simple-claude-bot/shared/shared/types';
import type { PlatformChannel } from './platform/types';
import type { PlatformMessageInput } from './types';

function calculateTypingDelay(message: string): number {
  return 100 + message.length * 30;
}

export async function dispatchReplies(channel: PlatformChannel, replies: Reply[], messages?: PlatformMessageInput[]): Promise<CallbackResponse['delivered']> {
  const messagesByUserId = new Map<string, PlatformMessageInput>();
  if (messages) {
    for (const m of messages) {
      messagesByUserId.set(m.authorId, m);
    }
  }

  const delivered: CallbackResponse['delivered'] = [];
  for (let i = 0; i < replies.length; i++) {
    const reply = replies[i];

    if (i > 0) {
      const delay = calculateTypingDelay(reply.message);
      logger.debug(`Typing delay ${delay}ms before reply ${i + 1}/${replies.length}`);
      await setTimeout(delay);
    }

    const target = reply.replyTo && reply.ping ? messagesByUserId.get(reply.replyTo) : undefined;
    const sent = target ? await channel.replyTo(target, reply.message) : await channel.sendMessage(reply.message);

    for (const s of sent) {
      delivered.push({
        discordMessageId: s.id,
        correlationId: reply.correlationId,
        timestamp: new Date(s.timestamp).toISOString(),
        message: s.message,
      });
    }
  }
  return delivered;
}
