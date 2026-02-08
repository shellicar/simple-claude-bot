import { query, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages/messages';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';
import { Message, TextChannel } from 'discord.js';
import { Instant, ZoneId } from '@js-joda/core';
import '@js-joda/timezone';
import { chunkMessage } from './chunkMessage.js';
import { logger } from './logger.js';
import { parseResponse } from './parseResponse.js';

const IMAGE_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

const zone = ZoneId.systemDefault();

const SESSION_FILE = '.bot.session';

let sessionId: string | undefined = existsSync(SESSION_FILE)
  ? readFileSync(SESSION_FILE, 'utf-8').trim() || undefined
  : undefined;

export function buildSystemPrompt(botUserId: string | undefined): string {
  return `You are a helpful assistant in a Discord group chat.
Messages will be formatted as "[timestamp] username (userId): message". The username is their display name and the userId in parentheses is their unique identifier. Users may change their display name, so always use the userId for replyTo.
Images attached to messages will be included inline for you to see.
${botUserId ? `Your Discord user ID is ${botUserId}. When users mention you with <@${botUserId}>, they are talking to you.` : ''}

You MUST always respond using the following template format. Each reply is a block separated by ---. You may send one or more replies.

---
replyTo: userId
message: Your message here
---

Fields:
- replyTo (optional): The userId to reply to. Must be the userId (not the display name). If omitted, the message is sent to the channel without replying to anyone.
- delay (optional): Milliseconds to wait after the previous message before sending this one. If omitted, send immediately.
- message (required): The content of your reply. Can be multiple lines. Use the person's display name when addressing them, not their userId.

Example with multiple replies:
---
replyTo: 123456789
message: Hey Alice, great question! The answer is 42.
---
delay: 1000
replyTo: 987654321
message: Bob, I think you're right about that.
---
delay: 500
message: Hope that helps everyone!
---

Rules:
- Always use this template, even for a single reply.
- You decide how many replies to send and whether to use delays.
- delay is the number of milliseconds to wait after the previous message before sending this one.
- Not every message needs a reply. If no reply is needed, respond with just --- and nothing else.`;
}

function buildContentBlocks(messages: Message[]): ContentBlockParam[] {
  const blocks: ContentBlockParam[] = [];

  for (const m of messages) {
    const zdt = Instant.ofEpochMilli(m.createdTimestamp).atZone(zone);
    blocks.push({
      type: 'text',
      text: `[${zdt.toString()}] ${m.author.displayName} (${m.author.id}): ${m.content}`,
    });

    for (const attachment of m.attachments.values()) {
      if (attachment.contentType && IMAGE_CONTENT_TYPES.has(attachment.contentType)) {
        blocks.push({
          type: 'image',
          source: {
            type: 'url',
            url: attachment.url,
          },
        });
      } else {
        blocks.push({
          type: 'text',
          text: `[attachment: ${attachment.url}]`,
        });
      }
    }
  }

  return blocks;
}

export async function respondToMessages(
  messages: Message[],
  channel: TextChannel,
  systemPrompt: string,
): Promise<void> {
  try {
    await channel.sendTyping();

    const contentBlocks = buildContentBlocks(messages);
    const hasImages = contentBlocks.some((b) => b.type === 'image');

    const promptText = contentBlocks
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    logger.info(`Prompt: ${promptText}`);

    const prompt = hasImages
      ? (async function* () {
          yield {
            type: 'user',
            message: {
              role: 'user',
              content: contentBlocks,
            },
            parent_tool_use_id: null,
            session_id: sessionId ?? '',
          } satisfies SDKUserMessage;
        })()
      : promptText;

    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      logger.debug(`Still waiting after ${elapsed}s...`);
    }, 5000);

    let result = '';
    try {
      const q = query({
        prompt,
        options: {
          pathToClaudeCodeExecutable: '/home/stephen/.local/bin/claude',
          model: 'claude-opus-4-6',
          allowedTools: ['WebSearch', 'WebFetch'],
          maxTurns: 3,
          systemPrompt,
          ...(sessionId ? { resume: sessionId } : {}),
        },
      });

      for await (const msg of q) {
        if (msg.type === 'system' && msg.subtype === 'init') {
          sessionId = msg.session_id;
          writeFileSync(SESSION_FILE, sessionId);
        }
        if (msg.type === 'result' && msg.subtype === 'success') {
          result = msg.result;
        }
      }
    } finally {
      clearInterval(timer);
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    logger.info(`Response (${elapsed}s): ${result}`);

    if (!result) {
      logger.warn('Empty response from Claude');
      await channel.send('Sorry, I didn\'t get a response. Please try again.');
      return;
    }

    const replies = parseResponse(result);

    if (replies.length === 0) {
      logger.debug('No replies to send');
      return;
    }

    const messagesByUserId = new Map<string, Message>();
    for (const m of messages) {
      messagesByUserId.set(m.author.id, m);
    }

    for (const reply of replies) {
      if (reply.delay) {
        await setTimeout(reply.delay);
      }

      const target = reply.replyTo ? messagesByUserId.get(reply.replyTo) : undefined;

      for (const chunk of chunkMessage(reply.message)) {
        if (target) {
          await target.reply(chunk);
        } else {
          await channel.send(chunk);
        }
      }
    }
  } catch (error) {
    logger.error(`Error processing message: ${error}`);
    sessionId = undefined;
    await channel.send('Sorry, I encountered an error processing your message.');
  }
}
