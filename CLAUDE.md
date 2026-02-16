# Claude Instructions for simple-claude-bot

## Project Overview

A Discord bot that provides Claude AI chat in a dedicated channel using the Claude Agent SDK (backed by a Claude Code subscription). Features sandbox tools, idle work/play behaviour, and session continuity.

## Architecture

Turborepo monorepo with separate apps communicating via HTTP:

- **`apps/ears`** — Discord gateway. Listens for messages, manages typing indicators, dispatches replies. Lightweight, no Claude SDK dependency.
- **`apps/brain`** — Hono HTTP server wrapping the Claude Agent SDK. Handles `/respond`, `/unprompted`, `/direct`, `/compact`, `/reset`, `/ping`, `/session`, `/health` endpoints. Heavy image with Claude Code subprocess and sandbox tools.
- **`apps/config`** — Discord bot setup and verification tools. `setup` checks intents and generates an invite URL; `verify` confirms guild membership, permissions, and channel existence.
- **`packages/shared`** — Shared types, logger, and platform interfaces.

Both ears and brain produce self-contained esbuild bundles. Brain needs `node_modules` at runtime for `@anthropic-ai/claude-code` (subprocess executable). Ears needs no runtime dependencies.

Deployment: `banananetv1/compose.yaml` runs brain and ears as separate containers. Brain exposes port 3000, ears connects via `BRAIN_URL`.

## Key Design Decisions

1. **Single channel only** — Bot responds only in a channel matching `CLAUDE_CHANNEL` env var (default: "claude")
2. **Message queuing** — If already processing, new messages queue and are batched when ready
3. **Session-based context** — Uses Claude Agent SDK session resumption for conversation continuity
4. **Platform abstraction** — Core logic uses `PlatformChannel`/`PlatformMessage` interfaces; Discord-specific code is isolated in `apps/ears/src/platform/discord/`
5. **Sandbox tools** — When `SANDBOX_ENABLED=true`, bot gets Bash, Read, Write, Edit, Glob, Grep tools
6. **Work/Play idle timer** — Bot can spontaneously chat or do sandbox work during quiet periods
7. **Quiet hours** — 22:00–10:00 local time, bot "sleeps" (no idle ticks)
8. **Ears/brain split** — Ears handles platform I/O, brain handles AI. Communicate via HTTP so they can scale and deploy independently.

## Environment Variables

### Ears (`apps/ears`)

- `DISCORD_TOKEN` — Required. Discord bot token.
- `DISCORD_GUILD` — Required. Discord guild ID.
- `CLAUDE_CHANNEL` — Optional. Channel name to respond in (default: "claude")
- `BOT_ALIASES` — Optional. Comma-separated previous bot names for history context
- `BRAIN_URL` — Optional. Brain HTTP endpoint (default: "http://brain:3000")
- `SANDBOX_ENABLED` — Optional. Tells ears whether sandbox is enabled, for system prompt (default: "false")
- `SANDBOX_COMMANDS` — Optional. CLI commands available in sandbox, shown in system prompt

### Brain (`apps/brain`)

- `CLAUDE_CONFIG_DIR` — Optional. Claude config directory (default: `~/.claude`)
- `SANDBOX_ENABLED` — Optional. Enable sandbox tools (default: "false")
- `SANDBOX_DIR` — Optional. Sandbox working directory (default: "./sandbox")
- `SANDBOX_COMMANDS` — Optional. CLI commands available in sandbox
- `AUDIT_DIR` — Optional. Audit log directory (default: "/audit")

## Commands

```bash
pnpm build          # Build all apps via turbo
pnpm type-check     # Type-check all apps via turbo
pnpm ci:fix         # Auto-fix lint issues (biome)
pnpm knip           # Detect unused exports/dependencies
./banananetv1/deploy.sh           # Build and deploy containers
./banananetv1/deploy.sh --build-only  # Build images only
```

## Stdin Commands (Ears)

- `/prompt` — Send an unprompted message
- `/workplay` — Manually trigger a work/play idle prompt
- `/compact` — Compact the current session
- `/reset [count]` — Reset session with channel history (default: 500 messages)
- `/session [id]` — Show current session ID, or switch to a different session
- `/direct <prompt>` — Direct query (separate session)
- `/ping` — Ping the brain SDK
- `/health` — Check brain health endpoint
- `/version` — Show build version, commit sha, and build date
- `/shutdown` — Graceful shutdown

## When Modifying

- Keep it simple — don't over-engineer
- Use `satisfies` for type safety where appropriate
- esbuild bundles everything — ears needs no runtime `node_modules`; brain needs `node_modules` only for `@anthropic-ai/claude-code`

## SDK Notes

- **`allowedTools`** controls which tools are **auto-approved** (no permission prompt), NOT which tools are available. To restrict available tools, use the `tools` option instead.

## Known Quirks

- `/compact` can fail with "No conversation found with session ID" — `cwd` is now passed but compact still doesn't use `buildQueryOptions` (no hooks, no settingSources). May need further investigation.
- **Discord attachment handling** — Images are downloaded to base64 for session stability. Non-image attachments (e.g. text files) are currently skipped with a warning to avoid session corruption (expired CDN URLs on resume). These should be downloaded and inlined as text content.
- **`UsageLimitError` on `stop_sequence` is too broad** — API 400 errors (e.g. expired image URLs) also have `stop_reason: 'stop_sequence'` and get incorrectly classified as usage limits (HTTP 502). Needs structured result parsing to distinguish API errors from actual usage limits.
- **`buildContentBlocks` uses `as ImageContentType` cast** — narrowing cast on `attachment.contentType`. Safe in practice since the value is checked against `IMAGE_CONTENT_TYPES`, but could be replaced with a type guard.

## Future Ideas

- **Dreaming**: During quiet hours (when the bot "sleeps"), instead of skipping idle ticks entirely, send a "dream" prompt — no sandbox tools, no chat output, just internal session thought. Dreams would persist in session memory and could influence the bot's conversation and behaviour when it wakes up.
- **Quiet hours message batching**: During quiet hours, queue incoming messages without sending them to the SDK. When quiet hours end, deliver all overnight messages in a single batch — gives the bot a natural "morning" wake-up moment.
- **Presence states**: Model the bot's availability as a state machine — Active (responds immediately, goes AFK after ~30 min idle), AFK (checks in periodically, transitions to Active when messages are found), and Sleeping (quiet hours, no check-ins, wakes with overnight batch). Creates natural response delays that feel human — someone who stepped away from their desk rather than an always-on service.
- **Mood/energy**: The bot's tone shifts based on activity levels. Busy day — energetic, chatty. Quiet day — more reflective. Just woke up — groggy. Could be a simple counter that influences the system prompt.
- **Reactions**: React with an emoji immediately on receiving a message (acknowledging it was seen), then respond with text later. More natural than silence followed by a wall of text.
- **Natural message style**: Instead of single verbose responses, chunk messages like a person would — short messages, multiple sends, natural pauses. Technical responses can still be longer. Think about how many messages a person would actually send.
- **Response throttling**: Global throttle that reduces the bot's allowed message volume the more it writes. Prevents runaway verbosity and encourages brevity over time.
- **Multi-platform**: Add a second platform implementation (e.g. Microsoft Teams) using the existing `PlatformChannel`/`PlatformMessage` interfaces in `apps/ears/src/platform/`.
