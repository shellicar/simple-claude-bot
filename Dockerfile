FROM node:22-slim

# Install sandbox dependencies, git, gh CLI, and Claude Code
RUN apt-get update \
  && apt-get install -y --no-install-recommends bubblewrap socat curl git ca-certificates gpg \
  && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends gh \
  && npm install -g @anthropic-ai/claude-code \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Create non-root user matching host uid for volume permissions
RUN useradd -m -s /bin/bash -u 1000 -o bot

# Enable pnpm
RUN corepack enable pnpm

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Copy built output
COPY dist/ dist/

# Copy Claude settings and hooks to staging (volume mount overlays /home/bot/.claude at runtime)
COPY claude-home/ /opt/claude-home/

# Lock down app files and create Claude wrapper that drops to bot user
RUN chmod -R 750 /app \
  && chmod +x /opt/claude-home/hooks/*.sh \
  && printf '#!/bin/sh\nexport HOME=/home/bot\nexec setpriv --reuid=bot --regid=bot --init-groups -- claude "$@"\n' > /usr/local/bin/claude-sandbox \
  && chmod +x /usr/local/bin/claude-sandbox

# Entrypoint copies Claude settings into the mounted volume, then runs the app
RUN printf '#!/bin/sh\ncp -r /opt/claude-home/* /home/bot/.claude/\nchown -R bot:bot /home/bot/.claude/hooks /home/bot/.claude/settings.json 2>/dev/null\nexec "$@"\n' > /usr/local/bin/entrypoint.sh \
  && chmod +x /usr/local/bin/entrypoint.sh

ENV TZ=Australia/Melbourne
ENV SANDBOX_DIR=/sandbox
ENV SANDBOX_ENABLED=true
ENV CLAUDE_PATH=/usr/local/bin/claude-sandbox
ENV CLAUDE_CONFIG_DIR=/home/bot/.claude

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "."]
