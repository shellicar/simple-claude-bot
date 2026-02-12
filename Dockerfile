FROM node:22-slim AS base

# Install sandbox dependencies and tools
RUN apt-get update \
  && apt-get install -y --no-install-recommends bubblewrap socat curl git ca-certificates gpg jq \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Install gh CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends gh \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Install Claude Code
RUN npm install -g @anthropic-ai/claude-code

# Enable pnpm for sandbox use
RUN corepack enable pnpm

# Create non-root user matching host uid for volume permissions
RUN useradd -m -s /bin/bash -u 1000 -o bot

FROM node:22-slim

COPY --from=base / /

WORKDIR /app

# Copy built output (esbuild bundle is self-contained)
COPY dist/ dist/

# Copy Claude settings and hooks to staging (volume mount overlays /home/bot/.claude at runtime)
COPY claude-home/ /opt/claude-home/

# Copy scripts
COPY scripts/claude-sandbox.sh /usr/local/bin/claude-sandbox
COPY scripts/entrypoint.sh /usr/local/bin/entrypoint.sh

# Lock down app files and set permissions
RUN chmod -R 750 /app \
  && chmod +x /opt/claude-home/hooks/*.sh \
  && chmod +x /usr/local/bin/claude-sandbox \
  && chmod +x /usr/local/bin/entrypoint.sh

ENV TZ=Australia/Melbourne
ENV SANDBOX_DIR=/sandbox
ENV SANDBOX_ENABLED=true
ENV CLAUDE_PATH=/usr/local/bin/claude-sandbox
ENV CLAUDE_CONFIG_DIR=/home/bot/.claude
ENV SANDBOX_COMMANDS="node, pnpm, git, gh, jq, curl"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/main.js"]
