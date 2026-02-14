import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { env } from 'node:process';
import { serve } from '@hono/node-server';
import versionInfo from '@shellicar/build-version/version';
import { logger } from '@simple-claude-bot/shared/logger';
import type { CompactResponse, DirectResponse, HealthResponse, PingResponse, ResetResponse, RespondResponse, UnpromptedResponse } from '@simple-claude-bot/shared/shared/types';
import { type Context, Hono } from 'hono';
import { ZodError } from 'zod';
import { initAuditLog } from '../auditLog';
import { brainSchema } from '../brainSchema';
import { directRequestSchema, resetRequestSchema, respondRequestSchema, unpromptedRequestSchema } from '../requestSchemas';
import { compactSession, directQuery, initSessionPaths, pingSDK, resetSession, respondToMessages, sendUnprompted } from '../respondToMessage';
import type { SandboxConfig } from '../types';

const main = async () => {
  const dockerBuildTime = process.env.BANANABOT_BUILD_TIME;
  const dockerBuildHash = process.env.BANANABOT_BUILD_HASH;
  logger.info(`Starting brain v${versionInfo.version} (${versionInfo.shortSha}) built ${versionInfo.buildDate} | docker: ${dockerBuildHash} built ${dockerBuildTime}`);

  const { CLAUDE_CONFIG_DIR, SANDBOX_ENABLED, SANDBOX_DIR, AUDIT_DIR } = brainSchema.parse(env);

  initSessionPaths(CLAUDE_CONFIG_DIR);
  initAuditLog(AUDIT_DIR);

  const sandboxConfig: SandboxConfig = {
    enabled: SANDBOX_ENABLED === 'true',
    directory: resolve(SANDBOX_DIR),
  };

  mkdirSync(sandboxConfig.directory, { recursive: true });
  logger.info(`Sandbox ${sandboxConfig.enabled ? 'enabled' : 'disabled'} (cwd: ${sandboxConfig.directory})`);

  function handleError(c: Context, route: string, error: unknown, errorBody: Record<string, unknown>) {
    if (error instanceof ZodError) {
      logger.error(`${route} validation error: ${error.message}`);
      return c.json({ ...errorBody, error: error.message }, 400);
    }
    logger.error(`${route} error: ${error}`);
    return c.json({ ...errorBody, error: String(error) }, 500);
  }

  const app = new Hono();

  app.get('/health', (c) => {
    return c.json({ status: 'ok' } satisfies HealthResponse);
  });

  app.post('/ping', async (c) => {
    try {
      const result = await pingSDK(sandboxConfig);
      return c.json({ result } satisfies PingResponse);
    } catch (error) {
      return handleError(c, '/ping', error, { result: '' });
    }
  });

  app.post('/respond', async (c) => {
    try {
      const body = respondRequestSchema.parse(await c.req.json());
      const replies = await respondToMessages(body, sandboxConfig);
      return c.json({ replies } satisfies RespondResponse);
    } catch (error) {
      return handleError(c, '/respond', error, { replies: [] });
    }
  });

  app.post('/unprompted', async (c) => {
    try {
      const body = unpromptedRequestSchema.parse(await c.req.json());
      const { replies, spoke } = await sendUnprompted(body, sandboxConfig);
      return c.json({ replies, spoke } satisfies UnpromptedResponse);
    } catch (error) {
      return handleError(c, '/unprompted', error, { replies: [], spoke: false });
    }
  });

  app.post('/direct', async (c) => {
    try {
      const body = directRequestSchema.parse(await c.req.json());
      const result = await directQuery(body, sandboxConfig);
      return c.json({ result } satisfies DirectResponse);
    } catch (error) {
      return handleError(c, '/direct', error, { result: '' });
    }
  });

  app.post('/compact', async (c) => {
    try {
      const result = await compactSession();
      return c.json({ result } satisfies CompactResponse);
    } catch (error) {
      return handleError(c, '/compact', error, { result: '' });
    }
  });

  app.post('/reset', async (c) => {
    try {
      const body = resetRequestSchema.parse(await c.req.json());
      const result = await resetSession(body, sandboxConfig);
      return c.json({ result } satisfies ResetResponse);
    } catch (error) {
      return handleError(c, '/reset', error, { result: '' });
    }
  });

  const port = 3000;
  serve({ fetch: app.fetch, port }, () => {
    logger.info(`Brain listening on port ${port}`);
  });
};

await main();
