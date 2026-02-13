import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { env } from 'node:process';
import { serve } from '@hono/node-server';
import versionInfo from '@shellicar/build-version/version';
import { Hono } from 'hono';
import { logger } from './logger.js';
import { type SandboxConfig, compactSession, directQuery, initSessionPaths, pingSDK, resetSession, respondToMessages, sendUnprompted } from './respondToMessage.js';
import { brainSchema } from './schema.js';
import type { CompactResponse, DirectRequest, DirectResponse, HealthResponse, PingResponse, ResetRequest, ResetResponse, RespondRequest, RespondResponse, UnpromptedRequest, UnpromptedResponse } from './shared/types.js';

const main = async () => {
  logger.info(`Starting brain v${versionInfo.version} (${versionInfo.shortSha}) built ${versionInfo.buildDate}`);

  const { CLAUDE_CONFIG_DIR, SANDBOX_ENABLED, SANDBOX_DIR } = brainSchema.parse(env);

  initSessionPaths(CLAUDE_CONFIG_DIR);

  const sandboxConfig: SandboxConfig = {
    enabled: SANDBOX_ENABLED === 'true',
    directory: resolve(SANDBOX_DIR),
  };

  mkdirSync(sandboxConfig.directory, { recursive: true });
  logger.info(`Sandbox ${sandboxConfig.enabled ? 'enabled' : 'disabled'} (cwd: ${sandboxConfig.directory})`);

  const app = new Hono();

  app.get('/health', (c) => {
    return c.json({ status: 'ok' } satisfies HealthResponse);
  });

  app.post('/ping', async (c) => {
    try {
      const result = await pingSDK(sandboxConfig);
      return c.json({ result } satisfies PingResponse);
    } catch (error) {
      logger.error(`/ping error: ${error}`);
      return c.json({ result: '', error: String(error) } satisfies PingResponse, 500);
    }
  });

  app.post('/respond', async (c) => {
    try {
      const body = await c.req.json<RespondRequest>();
      const replies = await respondToMessages(body.messages, body.systemPrompt, sandboxConfig);
      return c.json({ replies } satisfies RespondResponse);
    } catch (error) {
      logger.error(`/respond error: ${error}`);
      return c.json({ replies: [], error: String(error) } satisfies RespondResponse, 500);
    }
  });

  app.post('/unprompted', async (c) => {
    try {
      const body = await c.req.json<UnpromptedRequest>();
      const { replies, spoke } = await sendUnprompted(body.prompt, body.systemPrompt, sandboxConfig, {
        allowedTools: body.allowedTools,
        maxTurns: body.maxTurns,
      });
      return c.json({ replies, spoke } satisfies UnpromptedResponse);
    } catch (error) {
      logger.error(`/unprompted error: ${error}`);
      return c.json({ replies: [], spoke: false, error: String(error) } satisfies UnpromptedResponse, 500);
    }
  });

  app.post('/direct', async (c) => {
    try {
      const body = await c.req.json<DirectRequest>();
      const result = await directQuery(body.prompt, sandboxConfig);
      return c.json({ result } satisfies DirectResponse);
    } catch (error) {
      logger.error(`/direct error: ${error}`);
      return c.json({ result: '', error: String(error) } satisfies DirectResponse, 500);
    }
  });

  app.post('/compact', async (c) => {
    try {
      const result = await compactSession();
      return c.json({ result } satisfies CompactResponse);
    } catch (error) {
      logger.error(`/compact error: ${error}`);
      return c.json({ result: '', error: String(error) } satisfies CompactResponse, 500);
    }
  });

  app.post('/reset', async (c) => {
    try {
      const body = await c.req.json<ResetRequest>();
      const result = await resetSession(body.messages, body.systemPrompt, sandboxConfig);
      return c.json({ result } satisfies ResetResponse);
    } catch (error) {
      logger.error(`/reset error: ${error}`);
      return c.json({ result: '', error: String(error) } satisfies ResetResponse, 500);
    }
  });

  const port = 3000;
  serve({ fetch: app.fetch, port }, () => {
    logger.info(`Brain listening on port ${port}`);
  });
};

await main();
