import { logger } from '@simple-claude-bot/shared/logger';
import type { CompactResponse, DirectResponse, HealthResponse, PingResponse, ResetResponse, RespondResponse, SessionResponse, UnpromptedResponse } from '@simple-claude-bot/shared/shared/types';
import type { CompactRequestInput, DirectRequestInput, ResetRequestInput, RespondRequestInput, SessionSetRequestInput, UnpromptedRequestInput } from './types';

const TIMEOUT_MS = 10 * 60 * 1000;

export class BrainClient {
  public constructor(
    private readonly baseUrl: string,
    private readonly functionKey?: string,
  ) {}

  public async health(): Promise<HealthResponse> {
    return this.get<HealthResponse>('/health');
  }

  public async ping(): Promise<PingResponse> {
    return this.post<Record<string, never>, PingResponse>('/ping', {});
  }

  public async respond(request: RespondRequestInput): Promise<RespondResponse> {
    return this.post<RespondRequestInput, RespondResponse>('/respond', request);
  }

  public async unprompted(request: UnpromptedRequestInput): Promise<UnpromptedResponse> {
    return this.post<UnpromptedRequestInput, UnpromptedResponse>('/unprompted', request);
  }

  public async direct(request: DirectRequestInput): Promise<DirectResponse> {
    return this.post<DirectRequestInput, DirectResponse>('/direct', request);
  }

  public async compact(request: CompactRequestInput = {}): Promise<CompactResponse> {
    return this.post<CompactRequestInput, CompactResponse>('/compact', request);
  }

  public async reset(request: ResetRequestInput): Promise<ResetResponse> {
    return this.post<ResetRequestInput, ResetResponse>('/reset', request);
  }

  public async getSession(): Promise<SessionResponse> {
    return this.get<SessionResponse>('/session');
  }

  public async setSession(sessionId: string): Promise<SessionResponse> {
    return this.post<SessionSetRequestInput, SessionResponse>('/session', { sessionId });
  }

  private async withWaitingLog<T>(path: string, fn: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      logger.debug(`Brain ${path}: still waiting after ${elapsed}s...`);
    }, 5000);
    try {
      return await fn();
    } finally {
      clearInterval(timer);
    }
  }

  private buildHeaders(extra?: HeadersInit): HeadersInit {
    const headers: Record<string, string> = {};
    if (this.functionKey) {
      headers['x-functions-key'] = this.functionKey;
    }
    if (extra) {
      Object.assign(headers, extra);
    }
    return headers;
  }

  private async get<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    logger.debug(`Brain GET ${url}`);
    return this.withWaitingLog(path, async () => {
      const response = await fetch(url, { headers: this.buildHeaders(), signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Brain ${path} failed: ${response.status} ${response.statusText}: ${body}`);
      }
      return response.json() as Promise<T>;
    });
  }

  private async post<TReq, TRes>(path: string, body: TReq): Promise<TRes> {
    const url = `${this.baseUrl}${path}`;
    logger.debug(`Brain POST ${url}`);
    return this.withWaitingLog(path, async () => {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Brain ${path} failed: ${response.status} ${response.statusText}: ${body}`);
      }
      return response.json() as Promise<TRes>;
    });
  }
}
