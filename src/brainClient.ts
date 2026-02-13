import { logger } from './logger.js';
import type { CompactResponse, DirectRequest, DirectResponse, HealthResponse, PingResponse, ResetRequest, ResetResponse, RespondRequest, RespondResponse, UnpromptedRequest, UnpromptedResponse } from './shared/types.js';

const TIMEOUT_MS = 10 * 60 * 1000;

export class BrainClient {
  constructor(private readonly baseUrl: string) {}

  async health(): Promise<HealthResponse> {
    return this.get<HealthResponse>('/health');
  }

  async ping(): Promise<PingResponse> {
    return this.post<Record<string, never>, PingResponse>('/ping', {});
  }

  async respond(request: RespondRequest): Promise<RespondResponse> {
    return this.post<RespondRequest, RespondResponse>('/respond', request);
  }

  async unprompted(request: UnpromptedRequest): Promise<UnpromptedResponse> {
    return this.post<UnpromptedRequest, UnpromptedResponse>('/unprompted', request);
  }

  async direct(request: DirectRequest): Promise<DirectResponse> {
    return this.post<DirectRequest, DirectResponse>('/direct', request);
  }

  async compact(): Promise<CompactResponse> {
    return this.post<Record<string, never>, CompactResponse>('/compact', {});
  }

  async reset(request: ResetRequest): Promise<ResetResponse> {
    return this.post<ResetRequest, ResetResponse>('/reset', request);
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
