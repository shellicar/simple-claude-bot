import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { serve } from '@hono/node-server';
import { logger } from '@simple-claude-bot/shared/logger';
import { CallbackRequestSchema } from '@simple-claude-bot/shared/shared/platform/schema';
import type { CallbackResponse, Reply } from '@simple-claude-bot/shared/shared/types';
import { Hono } from 'hono';
import { z } from 'zod';
import type { PlatformChannel } from './platform/types';
import type { PlatformMessageInput } from './types';

export interface PendingRequest {
  channel: PlatformChannel;
  messages: PlatformMessageInput[];
  startedAt: number;
  /** Resolved when the message callback arrives — lets processQueue stay serial */
  resolve: () => void;
}

export interface CallbackServerOptions {
  port: number;
  host: string;
  dispatchReplies: (channel: PlatformChannel, replies: Reply[], messages?: PlatformMessageInput[]) => Promise<CallbackResponse['delivered']>;
}

export class CallbackServer {
  private server: Server | undefined;
  private readonly pendingRequests = new Map<string, PendingRequest>();
  private cleanupTimer: ReturnType<typeof setInterval> | undefined;
  private readonly maxWaitMs = 10 * 60 * 1000; // 10 minutes safety net

  public constructor(private readonly options: CallbackServerOptions) {}

  /**
   * Register a pending request and return the callback URL + a promise
   * that resolves when the message callback arrives (for queue serialization).
   */
  public createCallback(channel: PlatformChannel, messages: PlatformMessageInput[]): { callbackUrl: string; completed: Promise<void> } {
    const requestId = randomUUID();
    let resolve!: () => void;
    const completed = new Promise<void>((r) => {
      resolve = r;
    });

    this.pendingRequests.set(requestId, {
      channel,
      messages,
      startedAt: Date.now(),
      resolve,
    });

    return {
      callbackUrl: `${this.options.host}/callback/${requestId}`,
      completed,
    };
  }

  public start(): void {
    const app = new Hono();

    app.get('/', (c) => c.json({ status: 'ok' }));

    app.post('/callback/:requestId', async (c) => {
      const requestId = c.req.param('requestId');
      if (!z.uuid().safeParse(requestId).success) {
        return c.body(null, 400);
      }

      const context = this.pendingRequests.get(requestId);
      if (!context) {
        logger.warn(`Callback for unknown request ${requestId}`);
        return c.body(null, 404);
      }

      const payload = CallbackRequestSchema.parse(await c.req.json());

      switch (payload.type) {
        case 'typing': {
          await context.channel.sendTyping();
          return c.json({});
        }

        case 'message': {
          try {
            const delivered = await this.options.dispatchReplies(context.channel, payload.replies, context.messages);
            return c.json({ delivered } satisfies CallbackResponse);
          } catch (error) {
            logger.error(`Failed to dispatch replies: ${error}`);
            return c.json({ delivered: [] } satisfies CallbackResponse, 500);
          } finally {
            this.pendingRequests.delete(requestId);
            context.channel.clearTracked();
            context.resolve();
          }
        }
      }
    });

    this.server = serve({ fetch: app.fetch, port: this.options.port }, () => {
      logger.info(`Callback server listening on port ${this.options.port}`);
    }) as Server;

    // Safety net: clean up stale pending requests
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [id, ctx] of this.pendingRequests) {
        if (now - ctx.startedAt > this.maxWaitMs) {
          logger.warn(`Callback request ${id} timed out after ${Math.round((now - ctx.startedAt) / 1000)}s, cleaning up`);
          this.pendingRequests.delete(id);
          ctx.resolve(); // Unblock the queue even on timeout
        }
      }
    }, 60_000);
  }

  public stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.server?.close();
  }
}
