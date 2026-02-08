# Simple Claude Discord Bot

A minimal Discord bot that provides Claude AI chat in a dedicated channel.

## Features

- Responds only in a configured `#claude` channel
- Maintains conversation history with context
- Auto-trims history when approaching token limits (~180k)
- Ignores messages while processing (no queue complexity)
- No shell, git, or system commands - just chat

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

### 2. Get Anthropic API Key

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Sign in or create an account
3. Go to **"API Keys"** in the sidebar
4. Click **"Create Key"**
5. Copy the key - save this for later as `ANTHROPIC_API_KEY`

### 3. Invite Bot to Your Server

1. Back in Discord Developer Portal, go to **"OAuth2"** > **"URL Generator"**
2. Under **Scopes**, check: `bot`
3. Under **Bot Permissions**, check:
   - `View Channels`
   - `Send Messages`
   - `Read Message History`
4. Copy the **Generated URL** at the bottom
5. Open the URL in your browser
6. Select your server and click **"Authorize"**

### 4. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```bash
DISCORD_TOKEN=paste_your_discord_bot_token_here
ANTHROPIC_API_KEY=paste_your_anthropic_api_key_here
CLAUDE_CHANNEL=claude
```

### 5. Create the Channel

In your Discord server, create a text channel named `#claude` (or whatever you set in `CLAUDE_CHANNEL`).

### 6. Install & Run

```bash
pnpm install
pnpm build
pnpm start
```

You should see:

```text
Logged in as YourBotName#1234
Listening for messages in #claude
```

## Usage

Just send messages in the `#claude` channel. The bot will respond with Claude's replies and maintain conversation context.
