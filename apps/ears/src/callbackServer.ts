import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { logger } from '@simple-claude-bot/shared/logger';
import type { CallbackDeliveredMessage, CallbackMessageResponse, CallbackPayload, ParsedReply } from '@simple-claude-bot/shared/shared/types';
import type { PlatformChannel } from './platform/types';
import type { PlatformMessageInput } from './types';

export interface PendingRequest {
  channel: PlatformChannel;
  messages: PlatformMessageInput[];
  startedAt: number;
}

export interface CallbackServerOptions {
  port: number;
  host?: string;
  dispatchReplies: (channel: PlatformChannel, replies: ParsedReply[], messages?: PlatformMessageInput[]) => Promise<void>;
}

export class CallbackServer {
  private readonly server: Server;
  private readonly pendingRequests = new Map<string, PendingRequest>();
  private cleanupTimer: ReturnType<typeof setInterval> | undefined;
  private readonly maxWaitMs = 10 * 60 * 1000; // 10 minutes safety net

  public constructor(private readonly options: CallbackServerOptions) {
    this.server = createServer((req, res) => this.handleRequest(req, res));
  }

  /**
   * Register a pending request and return the callback URL for Brain.
   */
  public createCallbackUrl(channel: PlatformChannel, messages: PlatformMessageInput[]): string {
    const requestId = randomUUID();
    this.pendingRequests.set(requestId, {
      channel,
      messages,
      startedAt: Date.now(),
    });
    const host = this.options.host ?? `localhost:${this.options.port}`;
    return `http://${host}/callback/${requestId}`;
  }

  public start(): void {
    this.server.listen(this.options.port, () => {
      logger.info(`Callback server listening on port ${this.options.port}`);
    });

    // Safety net: clean up stale pending requests
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [id, ctx] of this.pendingRequests) {
        if (now - ctx.startedAt > this.maxWaitMs) {
          logger.warn(`Callback request ${id} timed out after ${Math.round((now - ctx.startedAt) / 1000)}s, cleaning up`);
          this.pendingRequests.delete(id);
        }
      }
    }, 60_000);
  }

  public stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.server.close();
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Parse URL: expect /callback/:requestId
    const match = req.url?.match(/^\/callback\/([a-f0-9-]+)$/);
    if (!match || req.method !== 'POST') {
      res.writeHead(404);
      res.end();
      return;
    }

    const requestId = match[1];
    const context = this.pendingRequests.get(requestId);
    if (!context) {
      logger.warn(`Callback for unknown request ${requestId}`);
      res.writeHead(404);
      res.end();
      return;
    }

    try {
      const body = await this.readBody(req);
      const payload = JSON.parse(body) as CallbackPayload;

      switch (payload.type) {
        case 'typing': {
          await context.channel.sendTyping();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('{}');
          break;
        }

        case 'message': {
          // Deliver replies to Discord
          await this.options.dispatchReplies(context.channel, payload.replies, context.messages);

          // Clean up — this request is complete
          this.pendingRequests.delete(requestId);
          context.channel.clearTracked();

          // Respond with delivered message IDs (placeholder — actual IDs need dispatchReplies to return them)
          const delivered: CallbackDeliveredMessage[] = payload.replies.map((_, index) => ({
            index,
            messageId: '', // TODO: capture actual Discord message IDs from dispatchReplies
          }));

          const responseBody: CallbackMessageResponse = { delivered };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(responseBody));
          break;
        }

        default: {
          logger.warn(`Unknown callback type: ${(payload as { type: string }).type}`);
          res.writeHead(400);
          res.end();
        }
      }
    } catch (error) {
      logger.error(`Callback handler error: ${error}`);
      res.writeHead(500);
      res.end();
    }
  }

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks).toString()));
      req.on('error', reject);
    });
  }
}
