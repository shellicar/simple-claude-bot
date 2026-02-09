import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

export const discordSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
});

export const botSchema = z.object({
  CLAUDE_CHANNEL: z.string().min(1).default('claude'),
  CLAUDE_CONFIG_DIR: z.string().default(join(homedir(), '.claude')),
  DISCORD_GUILD: z.string().min(1),
  SANDBOX_ENABLED: z.string().default('false'),
  SANDBOX_DIR: z.string().default('./sandbox'),
  BOT_ALIASES: z.string().default(''),
});
