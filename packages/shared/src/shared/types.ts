export interface ParsedReply {
  replyTo?: string;
  ping?: boolean;
  delay?: number;
  message: string;
}

export interface RespondResponse {
  readonly replies: ParsedReply[];
  readonly error?: string;
}

export interface UnpromptedResponse {
  readonly replies: ParsedReply[];
  readonly spoke: boolean;
  readonly error?: string;
}

export interface DirectResponse {
  readonly result: string;
  readonly error?: string;
}

export interface CompactResponse {
  readonly result: string;
  readonly error?: string;
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

export interface SessionResponse {
  readonly sessionId: string | null;
}

export interface VersionResponse {
  readonly version: string;
  readonly shortSha: string;
  readonly buildDate: string;
}
