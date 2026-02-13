import type { ParsedReply } from '../parseResponse';
import type { PlatformMessage } from './platform/types';

// --- Brain HTTP contract ---

export interface RespondRequest {
  readonly messages: PlatformMessage[];
  readonly systemPrompt: string;
}

export interface RespondResponse {
  readonly replies: ParsedReply[];
  readonly error?: string;
}

export interface UnpromptedRequest {
  readonly prompt: string;
  readonly systemPrompt: string;
  readonly allowedTools?: string[];
  readonly maxTurns?: number;
}

export interface UnpromptedResponse {
  readonly replies: ParsedReply[];
  readonly spoke: boolean;
  readonly error?: string;
}

export interface DirectRequest {
  readonly prompt: string;
  readonly systemPrompt: string;
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
  readonly messages: PlatformMessage[];
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
