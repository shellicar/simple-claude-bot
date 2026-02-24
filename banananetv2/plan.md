# Banananet v2 — Brain Azure Migration Plan

## Current State (2026-02-24)

### What's Working (Flex Consumption — to be replaced)

- **brain-azure** is deployed to Azure Functions Flex Consumption and responding
- SDK authenticates successfully (`ping` returns `pong`)
- File share mounts confirmed:
  - `/bot` (home share) — credentials synced via `infra/sync-home.sh`
  - `/sandbox` — empty, writable, sync available via `infra/sync-sandbox.sh`
  - `/audit` — mounted for audit logs
- `BOT_HOME=/bot` overrides `HOME` in Claude subprocess via `buildSandboxEnv.ts`
- `CLAUDE_CONFIG_DIR=/bot/.claude` points brain-core to the right config
- Version endpoint working
- Direct queries working (tested with sandbox access check)

### What's Done in Code (Uncommitted)

- `apps/ears/src/brainClient.ts` — added optional `functionKey` param, sends `x-functions-key` header
- `apps/ears/src/earsSchema.ts` — added optional `BRAIN_KEY` env var
- `apps/ears/src/entry/ears.ts` — passes `BRAIN_KEY` through to `BrainClient`
- `banananetv2/compose.yaml` — ears-only compose (no brain service)
- `banananetv2/ears.env` — configured with `BRAIN_URL` (Azure Functions `/api` base) and `BRAIN_KEY`
- `banananetv2/deploy.sh` — single-image deploy script
- `infra/sync-sandbox.sh` — azcopy sync for sandbox directory
- Prior uncommitted: Bicep changes (audit share, app settings), `buildSandboxEnv.ts` BOT_HOME, version endpoint, etc.

## The Problem: Sandbox Tooling

Azure Functions Flex Consumption runs on a **managed image** we don't control. The bot currently has:

| Tool | Flex Consumption | Docker (v1) |
|------|-----------------|-------------|
| node | yes | yes |
| npm | yes | yes |
| python3 | yes | yes |
| jq | yes | yes |
| curl | yes | yes |
| git | **NO** | yes |
| pnpm | **NO** | yes |
| gh | **NO** | yes |
| gpg | **NO** | yes |
| ssh | **NO** | yes |
| bicep | **NO** | yes |

The brain Dockerfile (`apps/brain/Dockerfile`) installs all of these. On Flex Consumption, we can't install packages — no `apt`, and even if a startup script could run, it would add cold start latency and be fragile.

**The full sandbox toolset is essential and will grow over time.** This makes Flex Consumption the wrong hosting model for brain.

## Next Step: Azure Functions on Container Apps

Migrate from Flex Consumption to **Azure Functions hosted on Container Apps**. This keeps the Azure Functions programming model (HTTP triggers, `@azure/functions` SDK, `host.json`) but runs inside a custom Docker container where we control the image and all installed tools.

Reference: https://learn.microsoft.com/en-us/azure/container-apps/functions-overview

### How It Works

- Deploy Functions app as a **custom Docker container** onto Container Apps
- Resource type is `Microsoft.App/containerApps` with `kind: 'functionapp'` (NOT `Microsoft.Web/sites`)
- CLI: `az containerapp create ... --kind functionapp`
- All `@azure/functions` triggers, `host.json`, bindings work unchanged
- KEDA handles auto-scaling based on triggers (HTTP for us) — no manual scale rules needed
- Scale to zero supported, up to 1,000 instances

### Why Functions on Container Apps

- **Keep brain-azure code as-is** — all HTTP trigger entry points unchanged
- **Custom Docker image** — install whatever tools we want (and add more over time)
- **Azure Files mounts** — Container Apps Environment supports file share mounts
- **Scale to zero** — cost savings when idle (cold starts are accepted)
- **No extra charges** for the Functions programming model
- **KEDA auto-scaling** — HTTP triggers scale automatically

### What Carries Over (Everything)

- All brain-azure HTTP trigger code — unchanged
- `host.json` configuration
- Storage account and file shares (home, sandbox, audit)
- Sync scripts (sync-home.sh, sync-sandbox.sh)
- Ears changes (BRAIN_URL, BRAIN_KEY)
- banananetv2 compose (ears-only, pointing to remote brain)

### Important Caveats

- **Function access keys** — portal can't generate them on Container Apps. Options:
  - Azure Key Vault to store keys
  - App Service Authentication/Authorization
  - Internal ingress only (if ears is in the same VNet)
  - Azure API Management
  - Or just keep `BRAIN_KEY` and manage it manually
- **No deployment slots** — use blue-green deployment strategies instead
- **Cold starts accepted** — heavier than Flex Consumption (Docker image pull + start) but unavoidable without premium
- **Mandatory storage account** — still needed for triggers/logs/state (we already have one)
- **Ingress must be enabled** for auto-scaling to work

## Decisions Made

### 1. Log Analytics Workspace — Re-use shared

Re-use the existing shared Log Analytics workspace rather than creating a new one.

### 2. ACR — Shared, tenant-level, Basic SKU, standard RBAC

- **Shared ACR across the tenant** — primarily for banananet but reusable
- Basic SKU (MSDN subscription, minimise costs)
- Standard RBAC mode (`LegacyRegistryPermissions`) — no ABAC needed
- Container App pulls images via **managed identity** with `AcrPull` role
- We push images using our own credentials
- **Has its own Bicep module** (`infra/modules/container-registry.bicep`) so it's defined as code
- **Deployed separately** — not part of the normal `main.bicep` deployment
- In `main.bicep`, referenced as `existing` resource (for role assignments, image references, etc.)
- ABAC can be enabled later if repo-level scoping is ever needed

### 3. Scale — TBD

- Min replicas 0 (scale to zero) vs 1 (always-on) — decide based on cold start tolerance
- Cold starts are accepted as a tradeoff

### 4. Auth — TBD

- Function access keys don't work via portal on Container Apps
- Need to decide: Key Vault stored keys, managed `BRAIN_KEY`, or ingress-level auth

## Infrastructure Resources

### Existing (re-use)

- **Storage account** — `sghsaauedevbanananet01` (already has home, sandbox, audit file shares)
- **Log Analytics workspace** — shared (to be referenced)

### Existing (referenced as `existing` in main.bicep, deployed separately)

- **Azure Container Registry (ACR)** — shared tenant-level, Basic SKU, standard RBAC
  - Own Bicep module for creation/updates, deployed independently
  - `AcrPull` role assignment for Container App managed identity (created in main.bicep)

### New (to create in Bicep)

- **Container Apps Environment** — linked to shared Log Analytics workspace
  - Azure Files storage mounts for home, sandbox, audit shares
- **Container App** (`kind: 'functionapp'`) — the brain
  - Image from ACR
  - System-assigned managed identity (for ACR pull)
  - Azure Files volume mounts: `/bot`, `/sandbox`, `/audit`
  - Environment variables: BOT_HOME, CLAUDE_CONFIG_DIR, SANDBOX_ENABLED, SANDBOX_DIR, SANDBOX_COMMANDS
  - External HTTP ingress (port TBD — depends on Functions base image)
  - Min/max replicas: TBD

### Reference: Exported Portal Deployments

- Container App: `infra/func/Deployment-Microsoft.App-ContainerApp-Portal-c8c3f121-afac/deployment.json`
- ACR: `infra/func/Deployment-Microsoft.ContainerRegistry/deployment.json`

## What Needs to Change

1. **New Dockerfile for brain-azure** — based on the existing brain Dockerfile (same tool installs):
   - Same base image and tool installation as `apps/brain/Dockerfile`
   - Copies brain-azure dist, host.json, package.json, node_modules
   - Azure Functions Node.js worker needs to be included
   - Set appropriate entrypoint for Functions runtime
2. **Bicep changes** — replace Flex Consumption resources with:
   - ACR (Basic, standard RBAC)
   - Container Apps Environment (with Azure Files mounts)
   - Container App with `kind: 'functionapp'` and managed identity
   - `AcrPull` role assignment for managed identity → ACR
   - Storage account remains (already exists)
3. **Build/deploy script** — build Docker image, push to ACR, update container app

## Implementation Steps

1. Create Dockerfile for brain-azure (extend existing brain Dockerfile with Functions runtime)
2. Create shared ACR separately (if not already done — outside banananet Bicep)
3. Add Container Apps Environment to Bicep (linked to shared workspace, Azure Files mounts)
4. Add Container App (`kind: 'functionapp'`) to Bicep:
   - Image from ACR
   - System-assigned managed identity
   - `AcrPull` role assignment
   - Azure Files volume mounts for `/bot`, `/sandbox`, `/audit`
   - Environment variables
   - External HTTP ingress
   - Min/max replicas: TBD
5. Build and push brain-azure Docker image to ACR
6. Update `banananetv2/ears.env` with new container app URL
7. Test end-to-end — verify all tools available, sandbox works, sessions persist

## Reference

### Current Brain Dockerfile Tools

From `apps/brain/Dockerfile`:
```
apt: bubblewrap libicu-dev socat curl git ca-certificates gpg gpg-agent jq python3 python3-pip python3-venv openssh-client
custom: gh (GitHub CLI), bicep
corepack: pnpm
```

`SANDBOX_COMMANDS="node, pnpm, git, gh, jq, curl, python3, pip3, bicep, ssh, ssh-keygen"`

### Bicep Sample

Microsoft provides a Bicep sample for Functions on Container Apps:
https://github.com/Azure/azure-functions-on-container-apps/tree/main/samples/ACAKindfunctionapp

### ACR Portal Deployment Reference

- Registry: `testfunccontainerappsacr`
- SKU: Basic
- Location: australiaeast
- RBAC mode: `LegacyRegistryPermissions` (standard RBAC, not ABAC)
- API version: `2025-03-01-preview`
