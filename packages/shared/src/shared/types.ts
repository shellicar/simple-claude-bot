import type { z } from 'zod';
import type { CallbackRequestSchema, CallbackResponseSchema, CompactResponseSchema, DirectResponseSchema, HealthResponseSchema, PingResponseSchema, ReplySchema, ResetResponseSchema, RespondResponseSchema, SessionResponseSchema, UnpromptedResponseSchema, VersionResponseSchema } from './platform/schema';

export type Reply = z.infer<typeof ReplySchema>;

export type RespondResponse = z.infer<typeof RespondResponseSchema>;
export type UnpromptedResponse = z.infer<typeof UnpromptedResponseSchema>;
export type DirectResponse = z.infer<typeof DirectResponseSchema>;
export type CompactResponse = z.infer<typeof CompactResponseSchema>;
export type ResetResponse = z.infer<typeof ResetResponseSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type PingResponse = z.infer<typeof PingResponseSchema>;
export type SessionResponse = z.infer<typeof SessionResponseSchema>;
export type VersionResponse = z.infer<typeof VersionResponseSchema>;

export type CallbackRequest = z.infer<typeof CallbackRequestSchema>;
export type CallbackResponse = z.infer<typeof CallbackResponseSchema>;
