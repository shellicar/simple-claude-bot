FROM node:22-slim AS base

# Install sandbox dependencies and tools
RUN apt-get update \
  && apt-get install -y --no-install-recommends bubblewrap libicu-dev socat curl git ca-certificates gpg jq python3 python3-pip python3-venv \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Install gh CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends gh \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Install Bicep CLI
RUN curl -fsSL https://github.com/Azure/bicep/releases/latest/download/bicep-linux-x64 -o /usr/local/bin/bicep \
  && chmod +x /usr/local/bin/bicep

# Enable pnpm for sandbox use
RUN corepack enable pnpm

# Create non-root user matching host uid for volume permissions
RUN useradd -m -s /bin/bash -u 1000 -o bot

FROM node:22-slim

COPY --from=base / /

WORKDIR /app

# Copy built output (esbuild bundle is self-contained)
COPY apps/brain/dist/ dist/

# Install Claude Code from project dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/brain/package.json apps/brain/package.json
RUN pnpm install --prod --frozen-lockfile --filter=@simple-claude-bot/brain

# Copy Claude settings and hooks to staging (volume mount overlays /home/bot/.claude at runtime)
COPY claude-home/ /opt/claude-home/

# Copy scripts
COPY scripts/claude-sandbox.sh /usr/local/bin/claude-sandbox
COPY scripts/brain-entrypoint.sh /usr/local/bin/entrypoint.sh

# Lock down app files and set permissions
RUN chmod -R 750 /app \
  && chmod o+x /app \
  && chmod -R o+rX /app/node_modules \
  && chmod +x /opt/claude-home/hooks/*.sh \
  && chmod +x /usr/local/bin/claude-sandbox \
  && chmod +x /usr/local/bin/entrypoint.sh

ENV TZ=Australia/Melbourne
ENV SANDBOX_DIR=/sandbox
ENV SANDBOX_ENABLED=true
ENV CLAUDE_PATH=/usr/local/bin/claude-sandbox
ENV CLAUDE_CONFIG_DIR=/home/bot/.claude
ENV SANDBOX_COMMANDS="node, pnpm, git, gh, jq, curl, python3, pip3, bicep"

HEALTHCHECK --interval=5s --timeout=5s --retries=10 --start-period=5s \
  CMD curl -f http://localhost:3000/health || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/brain.js"]
