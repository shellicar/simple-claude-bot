import { z } from 'zod';

export const discordSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
});

export const botSchema = z.object({
  CLAUDE_CHANNEL: z.string().min(1).default('claude'),
  DISCORD_GUILD: z.string().min(1),
  SANDBOX_ENABLED: z.string().default('false'),
  SANDBOX_DIR: z.string().default('./sandbox'),
});
