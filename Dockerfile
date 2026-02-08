FROM node:22-slim

# Install sandbox dependencies and Claude Code
RUN apt-get update \
  && apt-get install -y --no-install-recommends bubblewrap socat curl \
  && npm install -g @anthropic-ai/claude-code \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -s /bin/bash bot

# Enable pnpm
RUN corepack enable pnpm

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Copy built output
COPY dist/ dist/

# Set ownership for writable directories
RUN mkdir -p /app/sandbox && chown bot:bot /app /app/sandbox

USER bot

ENV SANDBOX_DIR=/app/sandbox
ENV SANDBOX_ENABLED=true

CMD ["node", "."]
