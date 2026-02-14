import { logger } from '@simple-claude-bot/shared/logger';
import type { CompactResponse, DirectRequest, DirectResponse, HealthResponse, PingResponse, ResetRequest, ResetResponse, RespondRequest, RespondResponse, SessionResponse, SessionSetRequest, UnpromptedRequest, UnpromptedResponse } from '@simple-claude-bot/shared/shared/types';

const TIMEOUT_MS = 10 * 60 * 1000;

export class BrainClient {
  public constructor(private readonly baseUrl: string) {}

  public async health(): Promise<HealthResponse> {
    return this.get<HealthResponse>('/health');
  }

  public async ping(): Promise<PingResponse> {
    return this.post<Record<string, never>, PingResponse>('/ping', {});
  }

  public async respond(request: RespondRequest): Promise<RespondResponse> {
    return this.post<RespondRequest, RespondResponse>('/respond', request);
  }

  public async unprompted(request: UnpromptedRequest): Promise<UnpromptedResponse> {
    return this.post<UnpromptedRequest, UnpromptedResponse>('/unprompted', request);
  }

  public async direct(request: DirectRequest): Promise<DirectResponse> {
    return this.post<DirectRequest, DirectResponse>('/direct', request);
  }

  public async compact(): Promise<CompactResponse> {
    return this.post<Record<string, never>, CompactResponse>('/compact', {});
  }

  public async reset(request: ResetRequest): Promise<ResetResponse> {
    return this.post<ResetRequest, ResetResponse>('/reset', request);
  }

  public async getSession(): Promise<SessionResponse> {
    return this.get<SessionResponse>('/session');
  }

  public async setSession(sessionId: string): Promise<SessionResponse> {
    return this.post<SessionSetRequest, SessionResponse>('/session', { sessionId });
  }

  private async get<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    logger.debug(`Brain GET ${url}`);
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) {
      throw new Error(`Brain ${path} failed: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  }

  private async post<TReq, TRes>(path: string, body: TReq): Promise<TRes> {
    const url = `${this.baseUrl}${path}`;
    logger.debug(`Brain POST ${url}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Brain ${path} failed: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<TRes>;
  }
}
