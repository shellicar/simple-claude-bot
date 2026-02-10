import { query, SDKMessage, type HookCallbackMatcher, type HookEvent, type HookInput, type Options, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages/messages';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
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
import { buildSystemPrompt } from './systemPrompts.js';

const claudePath = process.env.CLAUDE_PATH ?? execFileSync('which', ['claude'], { encoding: 'utf-8' }).trim();

export interface SandboxConfig {
  readonly enabled: boolean;
  readonly directory: string;
}

const SANDBOX_TOOLS = ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep'] as const;

const ENV_PASSTHROUGH = new Set([
  'HOME', 'PATH', 'SHELL', 'USER', 'HOSTNAME', 'TZ', 'TERM', 'LANG',
  'NODE_VERSION', 'YARN_VERSION',
]);

function buildSandboxEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of ENV_PASSTHROUGH) {
    if (process.env[key]) {
      env[key] = process.env[key];
    }
  }
  return env;
}

const IMAGE_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

export const zone = ZoneId.systemDefault();
export const timestampFormatter = DateTimeFormatter.ofPattern("EEEE, d MMMM yyyy 'at' HH:mm:ss VV (xxx)").withLocale(Locale.ENGLISH);

let claudeDir: string;
let DISCORD_SESSION_FILE: string;
let DIRECT_SESSION_FILE: string;
let COMPACT_FILE: string;

export function initSessionPaths(configDir: string): void {
  claudeDir = configDir;
  DISCORD_SESSION_FILE = join(claudeDir, '.bot.session');
  DIRECT_SESSION_FILE = join(claudeDir, '.bot.direct-session');
  COMPACT_FILE = join(claudeDir, '.bot.compact');
  discordSessionId = loadSessionId(DISCORD_SESSION_FILE);
  directSessionId = loadSessionId(DIRECT_SESSION_FILE);
}

function loadSessionId(file: string): string | undefined {
  return existsSync(file) ? readFileSync(file, 'utf-8').trim() || undefined : undefined;
}

let discordSessionId: string | undefined;
let directSessionId: string | undefined;

function logHook(input: HookInput): void {
  switch (input.hook_event_name) {
    case 'PostToolUse': {
      const toolInput = typeof input.tool_input === 'string' ? input.tool_input : JSON.stringify(input.tool_input);
      logger.info(`Tool use: ${input.tool_name} — ${toolInput}`);
      break;
    }
    case 'PostToolUseFailure':
      logger.warn(`Tool failure: ${input.tool_name} — ${input.error}`);
      break;
    case 'SessionStart':
      logger.info(`Session start: source=${input.source} model=${input.model ?? 'unknown'}`);
      break;
    case 'SessionEnd':
      logger.info(`Session end: reason=${input.reason}`);
      break;
    case 'SubagentStart':
      logger.info(`Subagent start: id=${input.agent_id} type=${input.agent_type}`);
      break;
    case 'SubagentStop':
      logger.info(`Subagent stop: id=${input.agent_id} type=${input.agent_type}`);
      break;
    case 'Notification':
      logger.info(`Notification: ${input.message}`);
      break;
  }
}

const hookMatcher: HookCallbackMatcher[] = [{
  hooks: [async (input) => {
    logHook(input);
    return { continue: true };
  }],
}];

const sdkHooks: Partial<Record<HookEvent, HookCallbackMatcher[]>> = {
  PostToolUse: hookMatcher,
  PostToolUseFailure: hookMatcher,
  SessionStart: hookMatcher,
  SessionEnd: hookMatcher,
  SubagentStart: hookMatcher,
  SubagentStop: hookMatcher,
  Notification: hookMatcher,
};

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
    systemPrompt,
    settingSources: ['user'],
    hooks: sdkHooks,
    ...(sandboxEnabled
      ? { sandbox: { enabled: true, autoAllowBashIfSandboxed: true }, env: buildSandboxEnv() }
      : {}),
    ...(sessionId ? { resume: sessionId } : {}),
  } satisfies Options;
}

type SDKMessageWithSubtype = SDKMessage & { subtype?: string };

const hasSubType = (m: SDKMessage): m is SDKMessageWithSubtype => {
  return 'subtype' in m;
}

interface ExecuteQueryOptions {
  channel?: TextChannel;
  showTyping?: boolean;
}

async function executeQuery(
  prompt: string | AsyncIterable<SDKUserMessage>,
  options: Options,
  onSessionId: (id: string) => void,
  queryOptions?: ExecuteQueryOptions,
): Promise<string> {
  const channel = queryOptions?.channel;
  const showTyping = queryOptions?.showTyping ?? true;
  const startTime = Date.now();
  if (channel && showTyping) {
    await channel.sendTyping();
  }
  const timer = setInterval(() => {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    logger.debug(`Still waiting after ${elapsed}s...`);
    if (showTyping) {
      channel?.sendTyping();
    }
  }, 5000);

  logger.debug(`Query options: ${JSON.stringify(options, undefined, 2)}`);

  let result = '';
  try {
    const q = query({ prompt, options });

    for await (const msg of q) {
      if (hasSubType(msg)) {
        logger.debug(`SDK message: ${msg.type}/${(msg as { subtype?: string }).subtype}`);
      }
      if (msg.type === 'system' && msg.subtype === 'init') {
        logger.info(`SDK init: session=${msg.session_id} model=${msg.model} permissionMode=${msg.permissionMode} tools=${msg.tools.join(',')}`);
        onSessionId(msg.session_id);
      }
      if (msg.type === 'tool_use_summary') {
        logger.info(`SDK tool use: ${msg.summary}`);
      }
      if (msg.type === 'result') {
        logger.info(
          `SDK result: cost=$${msg.total_cost_usd.toFixed(4)} tokens=${msg.usage.input_tokens}in/${msg.usage.output_tokens}out turns=${msg.num_turns} duration=${msg.duration_ms}ms`,
        );
        if (msg.subtype === 'success') {
          result = msg.result;
        } else {
          logger.error(`SDK result failure: ${JSON.stringify(msg)}`);
        }
      }
    }
  } catch (error) {
    if (result) {
      logger.warn(`SDK process error after successful result: ${error}`);
    } else {
      throw error;
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

  // Format messages as text with original display names
  const history = messages
    .map((m) => {
      const zdt = Instant.ofEpochMilli(m.createdTimestamp).atZone(zone);
      const prefix = m.author.bot ? '[BOT] ' : '';
      return `${prefix}[${zdt.format(timestampFormatter)}] ${m.author.displayName} (${m.author.id}): ${m.content}`;
    })
    .join('\n');

  const seedPrompt = `system: The following is the recent message history from the Discord channel. Internalize this context — these are the users you've been chatting with and the conversations you've had. Do not respond to these messages, just acknowledge that you have received the context.\n\n${history}`;

  const options = buildQueryOptions({
    systemPrompt: buildSystemPrompt({ type: 'reset' }),
    allowedTools: [],
    maxTurns: 1,
    sandboxConfig,
    sessionId: undefined,
  });

  const result = await executeQuery(seedPrompt, options, saveDiscordSession);
  logger.info(`Session reset complete. New session: ${discordSessionId}. Response: ${result}`);
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
    systemPrompt: buildSystemPrompt({ type: 'direct' }),
    allowedTools: ['WebSearch', 'WebFetch', 'Bash'],
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
  options?: { allowedTools?: string[]; maxTurns?: number; showTyping?: boolean },
): Promise<boolean> {
  try {
    logger.info(`Unprompted: ${prompt}`);

    const sdkOptions = buildQueryOptions({
      systemPrompt,
      allowedTools: options?.allowedTools ?? [],
      maxTurns: options?.maxTurns ?? 1,
      sandboxConfig,
      sessionId: discordSessionId,
    });

    const result = await executeQuery(prompt, sdkOptions, saveDiscordSession, { channel, showTyping: options?.showTyping });

    if (!result) {
      logger.warn('Empty unprompted response');
      return false;
    }

    const replies = parseResponse(result);

    if (replies.length === 0) {
      return false;
    }

    for (const reply of replies) {
      if (reply.delay) {
        await setTimeout(reply.delay);
      }
      for (const chunk of chunkMessage(reply.message)) {
        await channel.send(chunk);
      }
    }
    return true;
  } catch (error) {
    logger.error(`Error in unprompted message: ${error}`);
    discordSessionId = undefined;
    return false;
  }
}

export async function respondToMessages(
  messages: Message[],
  channel: TextChannel,
  systemPrompt: string,
  sandboxConfig: SandboxConfig,
): Promise<void> {
  try {
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

    const result = await executeQuery(prompt, options, saveDiscordSession, { channel });

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
        logger.debug(`Delaying ${reply.delay}ms before next message`);
        await setTimeout(reply.delay);
      }

      const target = reply.replyTo && reply.ping ? messagesByUserId.get(reply.replyTo) : undefined;

      for (const chunk of chunkMessage(reply.message)) {
        if (target) {
          await target.reply(chunk);
        } else {
          await channel.send(chunk);
        }
        logger.debug(`Sent message (${chunk.length} chars)`);
      }
    }
  } catch (error) {
    logger.error(`Error processing message: ${error}`);
    discordSessionId = undefined;
    await channel.send('Sorry, I encountered an error processing your message.');
  }
}
