import { z } from 'zod';

export const earsSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_GUILD: z.string().min(1),
  CLAUDE_CHANNEL: z.string().min(1).default('claude'),
  BOT_ALIASES: z.string().default(''),
  BRAIN_URL: z.string().min(1).default('http://brain:3000'),
  SANDBOX_ENABLED: z.string().default('false'),
  SANDBOX_COMMANDS: z.string().default(''),
});
