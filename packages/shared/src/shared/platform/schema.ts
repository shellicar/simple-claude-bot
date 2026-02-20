import type { UUID } from 'node:crypto';
import { z } from 'zod';

export const UuidSchema = z.uuid().transform((x) => x as UUID);

export const PlatformAttachmentSchema = z.object({
  url: z.string(),
  contentType: z.string().nullable(),
  data: z.string().optional(),
});

export const PlatformMessageSchema = z.object({
  authorId: z.string(),
  authorDisplayName: z.string(),
  authorIsBot: z.boolean(),
  content: z.string(),
  createdTimestamp: z.number(),
  attachments: z.array(PlatformAttachmentSchema),
});

export const RespondRequestSchema = z.object({
  messages: z.array(PlatformMessageSchema),
  systemPrompt: z.string(),
  allowedTools: z.array(z.string()),
});

export const UnpromptedRequestSchema = z.object({
  prompt: z.string(),
  systemPrompt: z.string(),
  allowedTools: z.array(z.string()).optional(),
  maxTurns: z.number().optional(),
});

export const DirectRequestSchema = z.object({
  prompt: z.string(),
  systemPrompt: z.string(),
  allowedTools: z.array(z.string()),
});

export const ResetRequestSchema = z.object({
  messages: z.array(PlatformMessageSchema),
  systemPrompt: z.string(),
});

export const SessionSetRequestSchema = z.object({
  sessionId: UuidSchema,
});

export const CompactRequestSchema = z.object({
  resumeSessionAt: UuidSchema.optional(),
});
