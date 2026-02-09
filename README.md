# Simple Claude Discord Bot

A minimal Discord bot that provides Claude AI chat in a dedicated channel using the Claude Agent SDK.

## Features

- Responds only in a configured channel within a specific guild
- Session-based conversation continuity via Claude Agent SDK session resumption
- Message queuing with batched processing
- Structured reply format with per-user replies, ping control, and delays
- Image attachment support (JPEG, PNG, GIF, WebP)
- Long message chunking for Discord's 2000 character limit
- WebSearch and WebFetch tools enabled for responses
- Optional sandboxed file access with SDK isolation
- Docker support with privilege separation and security hardening

## Setup

### 1. Create Discord Application & Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **"New Application"** (top right)
3. Give it a name (e.g., "Claude Bot") and click **Create**

#### Get Bot Token

1. In the left sidebar, click **"Bot"**
2. Click **"Reset Token"** (or "Add Bot" if first time)
3. Click **"Copy"** to copy your bot token - save this for later as `DISCORD_TOKEN`

#### Enable Required Intents

1. Scroll down to **"Privileged Gateway Intents"**
2. Enable **MESSAGE CONTENT INTENT** (required for reading message text)
3. Click **"Save Changes"**

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```bash
DISCORD_TOKEN=paste_your_discord_bot_token_here
CLAUDE_CHANNEL=claude
DISCORD_GUILD=your_guild_id
```

### 3. Install & Build

```bash
pnpm install
pnpm build
```

### 4. Invite Bot to Your Server

1. Run `pnpm setup` to verify your application and get an invite URL
2. Open the URL in your browser
3. Select your server and click **"Authorize"**

### 5. Create the Channel

In your Discord server, create a text channel named `#claude` (or whatever you set in `CLAUDE_CHANNEL`).

### 6. Verify Setup

```bash
pnpm verify
```

This checks the bot's permissions and channel access in the configured guild.

### 7. Run

```bash
pnpm start
```

## Docker

Build and run with Docker for sandboxed deployment:

```bash
pnpm docker:build
pnpm docker:run
```

The Docker image includes:
- Privilege separation: Node runs as root, Claude Code runs as unprivileged `bot` user
- Environment variable scrubbing: only safe system vars are passed to Claude Code
- PreToolUse hooks for blocking access to sensitive files
- Claude Code settings with deny rules for credentials

Requires mounting:
- `~/.claude/.credentials.json` (read-only) for Claude Code authentication
- `~/.claude-bot` for persistent bot state (sessions, settings)
- `./sandbox` for the sandbox working directory

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DISCORD_TOKEN` | Yes | — | Discord bot token |
| `CLAUDE_CHANNEL` | No | `claude` | Channel name to respond in |
| `DISCORD_GUILD` | Yes | — | Guild ID to restrict the bot to |
| `SANDBOX_ENABLED` | No | `false` | Enable sandboxed file access (Bash, Read, Write, Edit, Glob, Grep) |
| `SANDBOX_DIR` | No | `./sandbox` | Directory for sandboxed file operations |
| `CLAUDE_CONFIG_DIR` | No | `~/.claude` | Directory for Claude Code config and session files |
| `BOT_ALIASES` | No | — | Comma-separated list of previous bot usernames for history context |

## Usage

Send messages in the configured channel. The bot will respond with Claude's replies and maintain conversation context across sessions.

### Stdin Commands

- `/shutdown` — Exits gracefully
- `/prompt` — Sends an unprompted message (random thought/fun fact)
- `/compact` — Compacts the current session to reduce context size
- `/reset` — Resets the session and seeds it with recent channel history
- `/direct <prompt>` — Sends a direct query to Claude outside the Discord session
