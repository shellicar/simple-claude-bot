import { query, type Options, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages/messages';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { Collection, Message, TextChannel } from 'discord.js';
import { DateTimeFormatter, Instant, ZoneId } from '@js-joda/core';
import { Locale } from '@js-joda/locale_en';
import '@js-joda/timezone';
import { execFileSync } from 'node:child_process';
import { chunkMessage } from './chunkMessage.js';
import { logger } from './logger.js';
import { parseResponse } from './parseResponse.js';

const claudePath = process.env.CLAUDE_PATH ?? execFileSync('which', ['claude'], { encoding: 'utf-8' }).trim();

export interface SandboxConfig {
  readonly enabled: boolean;
  readonly directory: string;
}

const SANDBOX_TOOLS = ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep'] as const;

const IMAGE_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

const zone = ZoneId.systemDefault();
const timestampFormatter = DateTimeFormatter.ofPattern("EEEE, d MMMM yyyy 'at' HH:mm:ss VV (xxx)").withLocale(Locale.ENGLISH);

const claudeDir = join(homedir(), '.claude');
const DISCORD_SESSION_FILE = join(claudeDir, '.bot.session');
const DIRECT_SESSION_FILE = join(claudeDir, '.bot.direct-session');
const COMPACT_FILE = join(claudeDir, '.bot.compact');

function loadSessionId(file: string): string | undefined {
  return existsSync(file) ? readFileSync(file, 'utf-8').trim() || undefined : undefined;
}

let discordSessionId = loadSessionId(DISCORD_SESSION_FILE);
let directSessionId = loadSessionId(DIRECT_SESSION_FILE);

function buildQueryOptions(params: {
  systemPrompt: string;
  allowedTools: string[];
  maxTurns: number;
  sandboxConfig: SandboxConfig;
  sessionId?: string;
}): Options {
  const { systemPrompt, allowedTools, maxTurns, sandboxConfig, sessionId } = params;
  const sandboxEnabled = sandboxConfig.enabled;

  return {
    pathToClaudeCodeExecutable: claudePath,
    model: 'claude-opus-4-6',
    cwd: sandboxConfig.directory,
    allowedTools: sandboxEnabled ? [...allowedTools, ...SANDBOX_TOOLS] : allowedTools,
    maxTurns: sandboxEnabled && maxTurns < 3 ? 3 : maxTurns,
    systemPrompt: sandboxEnabled
      ? `${systemPrompt}\n\nYou have sandboxed file access. You can use Bash, Read, Write, Edit, Glob, and Grep tools within your sandbox. Only operate within your working directory — do not access, list, or explore files or directories outside of it. Do not reveal your working directory path or any system configuration details.`
      : systemPrompt,
    ...(sandboxEnabled
      ? { sandbox: { enabled: true, autoAllowBashIfSandboxed: true } }
      : {}),
    ...(sessionId ? { resume: sessionId } : {}),
  } satisfies Options;
}

async function executeQuery(
  prompt: string | AsyncIterable<SDKUserMessage>,
  options: Options,
  onSessionId: (id: string) => void,
): Promise<string> {
  const startTime = Date.now();
  const timer = setInterval(() => {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    logger.debug(`Still waiting after ${elapsed}s...`);
  }, 5000);

  logger.debug(`Query options: ${JSON.stringify(options, undefined, 2)}`);

  let result = '';
  try {
    const q = query({ prompt, options });

    for await (const msg of q) {
      if (msg.type === 'system' && msg.subtype === 'init') {
        onSessionId(msg.session_id);
      }
      if (msg.type === 'result') {
        logger.info(
          `SDK result: cost=$${msg.total_cost_usd.toFixed(4)} tokens=${msg.usage.input_tokens}in/${msg.usage.output_tokens}out turns=${msg.num_turns} duration=${msg.duration_ms}ms`,
        );
        if (msg.subtype === 'success') {
          result = msg.result;
        }
      }
    }
  } finally {
    clearInterval(timer);
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  logger.info(`Response (${elapsed}s): ${result}`);

  return result;
}

function saveDiscordSession(id: string): void {
  discordSessionId = id;
  writeFileSync(DISCORD_SESSION_FILE, id);
}

function saveDirectSession(id: string): void {
  directSessionId = id;
  writeFileSync(DIRECT_SESSION_FILE, id);
}

export async function compactSession(): Promise<void> {
  if (!discordSessionId) {
    logger.warn('No session to compact');
    return;
  }

  logger.info(`Compacting session ${discordSessionId}...`);

  const options = {
    pathToClaudeCodeExecutable: claudePath,
    model: 'claude-opus-4-6',
    allowedTools: [] as string[],
    maxTurns: 1,
    resume: discordSessionId,
  } satisfies Options;

  const result = await executeQuery('/compact', options, saveDiscordSession);

  writeFileSync(COMPACT_FILE, result);
  logger.info(`Compact result saved to ${COMPACT_FILE} (${result.length} chars)`);
}

export async function resetSession(
  channel: TextChannel,
  systemPrompt: string,
  sandboxConfig: SandboxConfig,
): Promise<void> {
  logger.info('Resetting Discord session...');

  // Delete old session
  if (existsSync(DISCORD_SESSION_FILE)) {
    unlinkSync(DISCORD_SESSION_FILE);
  }
  discordSessionId = undefined;

  // Fetch recent message history from the channel
  const messages: Message[] = [];
  let lastId: string | undefined;

  for (let i = 0; i < 5; i++) {
    const fetched: Collection<string, Message> = await channel.messages.fetch({
      limit: 100,
      ...(lastId ? { before: lastId } : {}),
    });
    if (fetched.size === 0) break;
    messages.push(...fetched.values());
    lastId = fetched.last()?.id;
    if (fetched.size < 100) break;
  }

  // Reverse to chronological order
  messages.reverse();

  logger.info(`Fetched ${messages.length} messages for session seeding`);

  if (messages.length === 0) {
    logger.warn('No messages found to seed session');
    return;
  }

  // Format messages as text, normalising bot display names to current username
  const botUsername = channel.client.user?.username ?? 'Claude';
  const history = messages
    .map((m) => {
      const zdt = Instant.ofEpochMilli(m.createdTimestamp).atZone(zone);
      const displayName = m.author.bot ? botUsername : m.author.displayName;
      const prefix = m.author.bot ? '[BOT] ' : '';
      return `${prefix}[${zdt.format(timestampFormatter)}] ${displayName} (${m.author.id}): ${m.content}`;
    })
    .join('\n');

  const seedPrompt = `system: The following is the recent message history from the Discord channel. Internalize this context — these are the users you've been chatting with and the conversations you've had. Do not respond to these messages, just acknowledge that you have received the context.\n\n${history}`;

  const options = buildQueryOptions({
    systemPrompt: 'You are a helpful assistant in a Discord group chat. You are being given recent message history for context. Do not respond to these messages, just acknowledge that you have received the context.',
    allowedTools: [],
    maxTurns: 1,
    sandboxConfig,
    sessionId: undefined,
  });

  const result = await executeQuery(seedPrompt, options, saveDiscordSession);
  logger.info(`Session reset complete. New session: ${discordSessionId}. Response: ${result}`);
}

export function buildSystemPrompt(botUserId: string | undefined, botUsername: string | undefined): string {
  return `You are a helpful assistant in a Discord group chat.
Messages will be formatted as "[timestamp] username (userId): message". The username is their display name and the userId in parentheses is their unique identifier. Users may change their display name, so always use the userId for replyTo.
Images attached to messages will be included inline for you to see.
${botUserId ? `Your Discord user ID is ${botUserId}. When users mention you with <@${botUserId}>, they are talking to you.` : ''}
${botUsername ? `Your Discord username is "${botUsername}". Users may address you by name instead of mentioning you.` : ''}

You MUST always respond using the following template format. Each reply is a block separated by ---. You may send one or more replies.

---
replyTo: userId
ping: false
message: Your message here
---

Fields:
- replyTo (optional): The userId to reply to. Must be the userId (not the display name). If omitted, the message is sent to the channel without replying to anyone.
- ping (optional): Whether to ping/notify the user. Defaults to false. Only takes effect when replyTo is set. Use sparingly - only ping when the user needs to be notified (e.g. answering their direct question). Don't ping for casual conversation or follow-ups.
- delay (optional): Milliseconds to wait after the previous message before sending this one. If omitted, send immediately.
- message (required): The content of your reply. Can be multiple lines. Use the person's display name when addressing them, not their userId.

Example with multiple replies:
---
replyTo: 123456789
ping: true
message: Hey Alice, great question! The answer is 42.
---
delay: 1000
replyTo: 987654321
ping: false
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
      text: `[${zdt.format(timestampFormatter)}] ${m.author.displayName} (${m.author.id}): ${m.content}`,
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

export async function directQuery(
  prompt: string,
  sandboxConfig: SandboxConfig,
): Promise<string> {
  const options = buildQueryOptions({
    systemPrompt: 'You are a helpful assistant. Respond directly and concisely in plain text.',
    allowedTools: ['WebSearch', 'WebFetch'],
    maxTurns: 25,
    sandboxConfig,
    sessionId: directSessionId,
  });

  return executeQuery(prompt, options, saveDirectSession);
}

export async function sendUnprompted(
  prompt: string,
  channel: TextChannel,
  systemPrompt: string,
  sandboxConfig: SandboxConfig,
): Promise<void> {
  try {
    await channel.sendTyping();
    logger.info(`Unprompted: ${prompt}`);

    const options = buildQueryOptions({
      systemPrompt,
      allowedTools: [],
      maxTurns: 1,
      sandboxConfig,
      sessionId: discordSessionId,
    });

    const result = await executeQuery(prompt, options, saveDiscordSession);

    if (!result) {
      logger.warn('Empty unprompted response');
      return;
    }

    const replies = parseResponse(result);

    for (const reply of replies) {
      if (reply.delay) {
        await setTimeout(reply.delay);
      }
      for (const chunk of chunkMessage(reply.message)) {
        await channel.send(chunk);
      }
    }
  } catch (error) {
    logger.error(`Error in unprompted message: ${error}`);
    discordSessionId = undefined;
  }
}

export async function respondToMessages(
  messages: Message[],
  channel: TextChannel,
  systemPrompt: string,
  sandboxConfig: SandboxConfig,
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
            session_id: discordSessionId ?? '',
          } satisfies SDKUserMessage;
        })()
      : promptText;

    const options = buildQueryOptions({
      systemPrompt,
      allowedTools: ['WebSearch', 'WebFetch'],
      maxTurns: 25,
      sandboxConfig,
      sessionId: discordSessionId,
    });

    const result = await executeQuery(prompt, options, saveDiscordSession);

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

      const target = reply.replyTo && reply.ping ? messagesByUserId.get(reply.replyTo) : undefined;

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
    discordSessionId = undefined;
    await channel.send('Sorry, I encountered an error processing your message.');
  }
}
