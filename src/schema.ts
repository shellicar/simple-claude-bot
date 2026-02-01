import { z } from 'zod';

export const discordSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
});

export const claudeSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  CLAUDE_CHANNEL: z.string().min(1).default('claude'),
});

