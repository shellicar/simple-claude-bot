import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type HookCallbackMatcher, type HookEvent, type HookInput, type Options, query, type SDKMessage, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages/messages';
import { Instant } from '@js-joda/core';
import '@js-joda/timezone';
import { logger } from '@simple-claude-bot/shared/logger';
import type { PlatformMessage } from '@simple-claude-bot/shared/shared/platform/types';
import type { DirectRequest, ParsedReply, ResetRequest, RespondRequest, UnpromptedRequest } from '@simple-claude-bot/shared/shared/types';
import { timestampFormatter } from '@simple-claude-bot/shared/timestampFormatter';
import { zone } from '@simple-claude-bot/shared/zone';
import { type AuditEntry, writeAuditEntry } from './auditLog';
import { parseResponse } from './parseResponse';
import type { SandboxConfig } from './types';

const claudePath = process.env.CLAUDE_PATH ?? 'claude';

const ENV_PASSTHROUGH = new Set(['HOME', 'PATH', 'SHELL', 'USER', 'HOSTNAME', 'TZ', 'TERM', 'LANG', 'NODE_VERSION', 'YARN_VERSION']);

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

const hookMatcher: HookCallbackMatcher[] = [
  {
    hooks: [
      async (input) => {
        logHook(input);
        return { continue: true };
      },
    ],
  },
];

const sdkHooks: Partial<Record<HookEvent, HookCallbackMatcher[]>> = {
  PostToolUse: hookMatcher,
  PostToolUseFailure: hookMatcher,
  SessionStart: hookMatcher,
  SessionEnd: hookMatcher,
  SubagentStart: hookMatcher,
  SubagentStop: hookMatcher,
  Notification: hookMatcher,
};

function buildQueryOptions(params: { systemPrompt: string; allowedTools: string[]; maxTurns: number; sandboxConfig: SandboxConfig; sessionId?: string }): Options {
  const { systemPrompt, allowedTools, maxTurns, sandboxConfig, sessionId } = params;
  const sandboxEnabled = sandboxConfig.enabled;

  return {
    pathToClaudeCodeExecutable: claudePath,
    model: 'claude-opus-4-6',
    cwd: sandboxConfig.directory,
    allowedTools,
    maxTurns: sandboxEnabled && maxTurns < 3 ? 3 : maxTurns,
    systemPrompt,
    settingSources: ['user'],
    hooks: sdkHooks,
    ...(sandboxEnabled ? { sandbox: { enabled: true, autoAllowBashIfSandboxed: true }, env: buildSandboxEnv() } : {}),
    ...(sessionId ? { resume: sessionId } : {}),
  } satisfies Options;
}

type SDKMessageWithSubtype = SDKMessage & { subtype?: string };

const hasSubType = (m: SDKMessage): m is SDKMessageWithSubtype => {
  return 'subtype' in m;
};

async function executeQuery(endpoint: string, prompt: string | AsyncIterable<SDKUserMessage>, options: Options, onSessionId: (id: string) => void): Promise<string> {
  const startTime = Date.now();
  const timer = setInterval(() => {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    logger.debug(`Still waiting after ${elapsed}s...`);
  }, 5000);

  logger.debug(`Query options: ${JSON.stringify(options, undefined, 2)}`);

  let result = '';
  let sessionId: string | undefined;
  let model: string | undefined;
  try {
    const q = query({ prompt, options });

    for await (const msg of q) {
      if (hasSubType(msg)) {
        logger.debug(`SDK message: ${msg.type}/${(msg as { subtype?: string }).subtype}`);
      }
      if (msg.type === 'system' && msg.subtype === 'init') {
        logger.info(`SDK init: session=${msg.session_id} model=${msg.model} permissionMode=${msg.permissionMode} tools=${msg.tools.join(',')}`);
        sessionId = msg.session_id;
        model = msg.model;
        onSessionId(msg.session_id);
      }
      if (msg.type === 'tool_use_summary') {
        logger.info(`SDK tool use: ${msg.summary}`);
      }
      if (msg.type === 'result') {
        logger.info(`SDK result: cost=$${msg.total_cost_usd.toFixed(4)} tokens=${msg.usage.input_tokens}in/${msg.usage.output_tokens}out turns=${msg.num_turns} duration=${msg.duration_ms}ms`);
        writeAuditEntry({
          timestamp: new Date().toISOString(),
          endpoint,
          sessionId,
          costUsd: msg.total_cost_usd,
          inputTokens: msg.usage.input_tokens,
          outputTokens: msg.usage.output_tokens,
          turns: msg.num_turns,
          durationMs: msg.duration_ms,
          model: model ?? 'unknown',
        } satisfies AuditEntry);
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

export async function compactSession(): Promise<string> {
  if (!discordSessionId) {
    logger.warn('No session to compact');
    return 'No session to compact';
  }

  logger.info(`Compacting session ${discordSessionId}...`);

  const options = {
    pathToClaudeCodeExecutable: claudePath,
    model: 'claude-opus-4-6',
    allowedTools: [] as string[],
    maxTurns: 1,
    resume: discordSessionId,
  } satisfies Options;

  const result = await executeQuery('/compact', '/compact', options, saveDiscordSession);

  writeFileSync(COMPACT_FILE, result);
  logger.info(`Compact result saved to ${COMPACT_FILE} (${result.length} chars)`);
  return result;
}

export async function resetSession(body: ResetRequest, sandboxConfig: SandboxConfig): Promise<string> {
  logger.info('Resetting Discord session...');

  // Delete old session
  if (existsSync(DISCORD_SESSION_FILE)) {
    unlinkSync(DISCORD_SESSION_FILE);
  }
  discordSessionId = undefined;

  logger.info(`Received ${body.messages.length} messages for session seeding`);

  if (body.messages.length === 0) {
    logger.warn('No messages found to seed session');
    return 'No messages found to seed session';
  }

  // Format messages as text with original display names
  const history = body.messages
    .map((m) => {
      const zdt = Instant.ofEpochMilli(m.createdTimestamp).atZone(zone);
      const prefix = m.authorIsBot ? '[BOT] ' : '';
      return `${prefix}[${zdt.format(timestampFormatter)}] ${m.authorDisplayName} (${m.authorId}): ${m.content}`;
    })
    .join('\n');

  const seedPrompt = `system: The following is the recent message history from the Discord channel. Internalize this context — these are the users you've been chatting with and the conversations you've had. Do not respond to these messages, just acknowledge that you have received the context.\n\n${history}`;

  const options = buildQueryOptions({
    systemPrompt: body.systemPrompt,
    allowedTools: [],
    maxTurns: 1,
    sandboxConfig,
    sessionId: undefined,
  });

  const result = await executeQuery('/reset', seedPrompt, options, saveDiscordSession);
  logger.info(`Session reset complete. New session: ${discordSessionId}. Response: ${result}`);
  return result;
}

function buildContentBlocks(messages: PlatformMessage[]): ContentBlockParam[] {
  const blocks: ContentBlockParam[] = [];

  for (const m of messages) {
    const zdt = Instant.ofEpochMilli(m.createdTimestamp).atZone(zone);
    blocks.push({
      type: 'text',
      text: `[${zdt.format(timestampFormatter)}] ${m.authorDisplayName} (${m.authorId}): ${m.content}`,
    });

    for (const attachment of m.attachments) {
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

export async function pingSDK(sandboxConfig: SandboxConfig): Promise<string> {
  const options = buildQueryOptions({
    systemPrompt: 'Respond with exactly: pong',
    allowedTools: [],
    maxTurns: 1,
    sandboxConfig,
  });

  return executeQuery('/ping', 'ping', options, () => {});
}

export async function directQuery(body: DirectRequest, sandboxConfig: SandboxConfig): Promise<string> {
  const options = buildQueryOptions({
    systemPrompt: body.systemPrompt,
    allowedTools: body.allowedTools,
    maxTurns: 25,
    sandboxConfig,
    sessionId: directSessionId,
  });

  return executeQuery('/direct', body.prompt, options, saveDirectSession);
}

export async function sendUnprompted(body: UnpromptedRequest, sandboxConfig: SandboxConfig): Promise<{ replies: ParsedReply[]; spoke: boolean }> {
  try {
    logger.info(`Unprompted: ${body.prompt}`);

    const sdkOptions = buildQueryOptions({
      systemPrompt: body.systemPrompt,
      allowedTools: body.allowedTools ?? [],
      maxTurns: body.maxTurns ?? 1,
      sandboxConfig,
      sessionId: discordSessionId,
    });

    const result = await executeQuery('/unprompted', body.prompt, sdkOptions, saveDiscordSession);

    if (!result) {
      logger.warn('Empty unprompted response');
      return { replies: [], spoke: false };
    }

    const replies = parseResponse(result);
    return { replies, spoke: replies.length > 0 };
  } catch (error) {
    logger.error(`Error in unprompted message: ${error}`);
    discordSessionId = undefined;
    return { replies: [], spoke: false };
  }
}

export async function respondToMessages(body: RespondRequest, sandboxConfig: SandboxConfig): Promise<ParsedReply[]> {
  const contentBlocks = buildContentBlocks(body.messages);
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
    systemPrompt: body.systemPrompt,
    allowedTools: body.allowedTools,
    maxTurns: 25,
    sandboxConfig,
    sessionId: discordSessionId,
  });

  const result = await executeQuery('/respond', prompt, options, saveDiscordSession);

  if (!result) {
    logger.warn('Empty response from Claude');
    return [];
  }

  return parseResponse(result);
}
