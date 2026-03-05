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

// --- Async Callback Types ---

export interface AcceptedResponse {
  readonly correlationId: string;
}

export interface CallbackTyping {
  readonly correlationId: string;
  readonly type: 'typing';
}

export interface CallbackMessage {
  readonly correlationId: string;
  readonly type: 'message';
  readonly replies: ParsedReply[];
}

export interface CallbackError {
  readonly correlationId: string;
  readonly type: 'error';
  readonly error: string;
}

export type CallbackPayload = CallbackTyping | CallbackMessage | CallbackError;

export interface CallbackDeliveredMessage {
  readonly index: number;
  readonly messageId: string;
}

export interface CallbackMessageResponse {
  readonly delivered: CallbackDeliveredMessage[];
}
