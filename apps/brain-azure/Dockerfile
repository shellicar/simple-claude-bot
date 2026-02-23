FROM mcr.microsoft.com/azure-functions/node:4-node22

ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    AzureFunctionsJobHost__Logging__Console__IsEnabled=true \
    TZ=Australia/Melbourne

RUN corepack enable pnpm

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
