FROM mcr.microsoft.com/azure-functions/node:4-node22

ENV AzureWebJobsScriptRoot=/home/site/wwwroot/apps/brain-azure \
    AzureFunctionsJobHost__Logging__Console__IsEnabled=true \
    TZ=Australia/Melbourne \
    SANDBOX_COMMANDS="node, pnpm, git, gh, jq, curl, python3, pip3, bicep, ssh, ssh-keygen"

# Install sandbox tools
RUN apt-get update \
  && apt-get install -y --no-install-recommends bubblewrap libicu-dev socat curl git ca-certificates gpg gpg-agent jq python3 python3-pip python3-venv openssh-client \
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

WORKDIR /home/site/wwwroot

# Install runtime dependencies (claude-agent-sdk is external in esbuild, claude-code is a subprocess)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/brain-azure/package.json apps/brain-azure/package.json
COPY packages/brain-core/package.json packages/brain-core/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --prod --frozen-lockfile --filter=@simple-claude-bot/brain-azure...

WORKDIR /home/site/wwwroot/apps/brain-azure

# Copy built output and Azure Functions config
COPY apps/brain-azure/dist/ dist/
COPY apps/brain-azure/host.json host.json

# Copy Claude settings and hooks to staging (volume mount overlays /home/bot/.claude at runtime)
COPY claude-home/ /opt/claude-home/

# Copy scripts
COPY scripts/claude-sandbox-azure.sh /usr/local/bin/claude-sandbox
COPY scripts/brain-entrypoint.sh /usr/local/bin/entrypoint.sh

# Lock down app files and set permissions
RUN chmod -R 750 /home/site/wwwroot \
  && chmod o+x /home/site/wwwroot /home/site/wwwroot/apps /home/site/wwwroot/apps/brain-azure \
  && chmod -R o+rX /home/site/wwwroot/node_modules /home/site/wwwroot/apps/brain-azure/node_modules \
  && chmod +x /opt/claude-home/hooks/*.sh \
  && chmod +x /usr/local/bin/claude-sandbox \
  && chmod +x /usr/local/bin/entrypoint.sh

ENV SANDBOX_DIR=/sandbox \
    SANDBOX_ENABLED=true \
    CLAUDE_PATH=/usr/local/bin/claude-sandbox \
    CLAUDE_CONFIG_DIR=/home/bot/.claude
