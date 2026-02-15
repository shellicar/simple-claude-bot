import { mkdirSync } from 'node:fs';
import type { Server } from 'node:http';
import { resolve } from 'node:path';
import { env } from 'node:process';
import { serve } from '@hono/node-server';
import versionInfo from '@shellicar/build-version/version';
import { logger } from '@simple-claude-bot/shared/logger';
import type { CompactResponse, DirectResponse, HealthResponse, PingResponse, ResetResponse, RespondResponse, SessionResponse, UnpromptedResponse } from '@simple-claude-bot/shared/shared/types';
import { type Context, Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ZodError } from 'zod';
import { initAuditLog } from '../audit/auditLog';
import { brainSchema } from '../brainSchema';
import { compactSession } from '../compactSession';
import { directQuery } from '../directQuery';
import { SdkError } from '../errors/SdkError';
import { getSessionId } from '../getSessionId';
import { initSessionPaths } from '../initSessionPaths';
import { pingSDK } from '../ping/pingSDK';
import { directRequestSchema, resetRequestSchema, respondRequestSchema, sessionSetRequestSchema, unpromptedRequestSchema } from '../requestSchemas';
import { respondToMessages } from '../respondToMessages';
import { resetSession } from '../session/resetSession';
import { setSessionId } from '../session/setSessionId';
import type { SandboxConfig } from '../types';
import { sendUnprompted } from '../unsolicited/sendUnprompted';

const main = async () => {
  const dockerBuildTime = process.env.BANANABOT_BUILD_TIME;
  const dockerBuildHash = process.env.BANANABOT_BUILD_HASH;
  logger.info(`Starting brain v${versionInfo.version} (${versionInfo.shortSha}) built ${versionInfo.buildDate} | docker: ${dockerBuildHash} built ${dockerBuildTime}`);

  const { CLAUDE_CONFIG_DIR, SANDBOX_ENABLED, SANDBOX_DIR, AUDIT_DIR } = brainSchema.parse(env);

  initSessionPaths(CLAUDE_CONFIG_DIR);
  initAuditLog(AUDIT_DIR);

  const sandboxConfig = {
    enabled: SANDBOX_ENABLED,
    directory: resolve(SANDBOX_DIR),
  } satisfies SandboxConfig;

  mkdirSync(sandboxConfig.directory, { recursive: true });
  logger.info(`Sandbox ${sandboxConfig.enabled ? 'enabled' : 'disabled'} (cwd: ${sandboxConfig.directory})`);

  function handleError(c: Context, route: string, error: unknown, errorBody: Record<string, unknown>) {
    logger.error(`${route} error`);
    logger.error(error);

    let statusCode: ContentfulStatusCode = 500;
    if (error instanceof ZodError) {
      statusCode = 400;
    } else if (error instanceof SdkError) {
      statusCode = error.httpCode;
    }

    logger.info('Http Response', {
      status: statusCode,
      body: { ...errorBody, error },
    });
    return c.json({ ...errorBody, error }, statusCode);
  }

  const app = new Hono();

  app.get('/health', (c) => {
    return c.json({ status: 'ok' } satisfies HealthResponse);
  });

  app.get('/session', (c) => {
    const sessionId = getSessionId() ?? null;
    return c.json({ sessionId } satisfies SessionResponse);
  });

  app.post('/session', async (c) => {
    try {
      const { sessionId } = sessionSetRequestSchema.parse(await c.req.json());
      setSessionId(sessionId);
      return c.json({ sessionId } satisfies SessionResponse);
    } catch (error) {
      return handleError(c, '/session', error, { sessionId: null });
    }
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
      const result = await compactSession(sandboxConfig);
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
  const server = serve({ fetch: app.fetch, port }, () => {
    logger.info(`Brain listening on port ${port}`);
  }) as Server;
  server.requestTimeout = 10 * 60 * 1000;
  server.headersTimeout = 10 * 60 * 1000 + 1000;
};

await main();
