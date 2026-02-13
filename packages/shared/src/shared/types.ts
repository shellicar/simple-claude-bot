export type { ParsedReply } from '../parseResponse.js';
export type { PlatformAttachment, PlatformMessage } from '../platform/types.js';

// --- Brain HTTP contract ---

export interface RespondRequest {
  readonly messages: import('../platform/types.js').PlatformMessage[];
  readonly systemPrompt: string;
}

export interface RespondResponse {
  readonly replies: import('../parseResponse.js').ParsedReply[];
  readonly error?: string;
}

export interface UnpromptedRequest {
  readonly prompt: string;
  readonly systemPrompt: string;
  readonly allowedTools?: string[];
  readonly maxTurns?: number;
}

export interface UnpromptedResponse {
  readonly replies: import('../parseResponse.js').ParsedReply[];
  readonly spoke: boolean;
  readonly error?: string;
}

export interface DirectRequest {
  readonly prompt: string;
}

export interface DirectResponse {
  readonly result: string;
  readonly error?: string;
}

export interface CompactResponse {
  readonly result: string;
  readonly error?: string;
}

export interface ResetRequest {
  readonly messages: import('../platform/types.js').PlatformMessage[];
  readonly systemPrompt: string;
}

export interface ResetResponse {
  readonly result: string;
  readonly error?: string;
}

export interface HealthResponse {
  readonly status: 'ok';
}

export interface PingResponse {
  readonly result: string;
  readonly error?: string;
}
