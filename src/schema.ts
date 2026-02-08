import { z } from 'zod';

export const discordSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
});

export const botSchema = z.object({
  CLAUDE_CHANNEL: z.string().min(1).default('claude'),
});
