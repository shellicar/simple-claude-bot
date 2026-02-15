import type { UUID } from 'node:crypto';
import { z } from 'zod';

export const uuidSchema = z.uuid('Must be a valid UUID').transform((x) => x as UUID);

const platformAttachmentSchema = z.object({
  url: z.string(),
  contentType: z.string().nullable(),
});

const platformMessageSchema = z.object({
  authorId: z.string(),
  authorDisplayName: z.string(),
  authorIsBot: z.boolean(),
  content: z.string(),
  createdTimestamp: z.number(),
  attachments: z.array(platformAttachmentSchema),
});

export const respondRequestSchema = z.object({
  messages: z.array(platformMessageSchema),
  systemPrompt: z.string(),
  allowedTools: z.array(z.string()),
});

export const unpromptedRequestSchema = z.object({
  prompt: z.string(),
  systemPrompt: z.string(),
  allowedTools: z.array(z.string()).optional(),
  maxTurns: z.number().optional(),
});

export const directRequestSchema = z.object({
  prompt: z.string(),
  systemPrompt: z.string(),
  allowedTools: z.array(z.string()),
});

export const resetRequestSchema = z.object({
  messages: z.array(platformMessageSchema),
  systemPrompt: z.string(),
});

export const sessionSetRequestSchema = z.object({
  sessionId: uuidSchema,
});
