# Claude Instructions for simple-claude-bot

## Project Overview

A Discord bot that provides Claude AI chat in a dedicated channel using the Claude Agent SDK (backed by a Claude Code subscription). Features sandbox tools, idle work/play behaviour, and session continuity.

## Key Design Decisions

1. **Single channel only** - Bot responds only in a channel matching `CLAUDE_CHANNEL` env var (default: "claude")
2. **Message queuing** - If already processing, new messages queue and are batched when ready
3. **Session-based context** - Uses Claude Agent SDK session resumption for conversation continuity
4. **Platform abstraction** - Core logic uses `PlatformChannel`/`PlatformMessage` interfaces; Discord-specific code is isolated in `src/platform/discord/`
5. **Sandbox tools** - When `SANDBOX_ENABLED=true`, bot gets Bash, Read, Write, Edit, Glob, Grep tools
6. **Work/Play idle timer** - Bot can spontaneously chat or do sandbox work during quiet periods
7. **Quiet hours** - 22:00–10:00 local time, bot "sleeps" (no idle ticks)
8. **esbuild bundle** - `dist/` is self-contained, no `pnpm install` needed in Docker

## Environment Variables

- `DISCORD_TOKEN` - Required. Discord bot token.
- `DISCORD_GUILD` - Required. Discord guild ID.
- `CLAUDE_CHANNEL` - Optional. Channel name to respond in (default: "claude")
- `SANDBOX_ENABLED` - Optional. Enable sandbox tools (default: "false")
- `SANDBOX_DIR` - Optional. Sandbox working directory (default: "./sandbox")
- `SANDBOX_COMMANDS` - Optional. CLI commands available in sandbox, shown in system prompt
- `BOT_ALIASES` - Optional. Comma-separated previous bot names for history context

## Commands

```bash
pnpm build          # Bundle with esbuild
pnpm start          # Run the bot
pnpm docker:build   # Build + docker build
pnpm docker:run     # Run Docker container
```

## Stdin Commands

- `/prompt` - Send an unprompted message
- `/workplay` - Manually trigger a work/play idle prompt
- `/compact` - Compact the current session
- `/reset` - Reset session with channel history
- `/direct <prompt>` - Direct query (separate session)
- `/version` - Show build version, commit sha, and build date
- `/shutdown` - Graceful shutdown

## When Modifying

- Keep it simple - don't over-engineer
- Use `satisfies` for type safety where appropriate
- esbuild bundles everything - no runtime `node_modules` needed in Docker

## Known Quirks

- `/compact` can fail with "No conversation found with session ID" — likely because the compact options don't include the sandbox/cwd configuration used when the session was created, but not yet investigated.

## Future Ideas

- **Dreaming**: During quiet hours (when the bot "sleeps"), instead of skipping idle ticks entirely, send a "dream" prompt — no sandbox tools, no chat output, just internal session thought. Dreams would persist in session memory and could influence the bot's conversation and behaviour when it wakes up.
- **Multi-platform**: Add a second platform implementation (e.g. Microsoft Teams) using the existing `PlatformChannel`/`PlatformMessage` interfaces in `src/platform/`.
