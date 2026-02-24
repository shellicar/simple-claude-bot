#!/bin/sh
# Sync local .claude-bot directory to the Azure Files 'home' share
# This uploads the bot's Claude config, credentials, and session data
# to the file share mounted at /bot on the function app.
#
# Usage:
#   infra/sync-home.sh [-d|--destructive]
#
# Dry run by default. Pass -d or --destructive to actually sync.
#
# Requires: azcopy, az CLI (logged in)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

STORAGE_ACCOUNT="sghsaauedevbanananet01"
SHARE_NAME="home"
SOURCE_DIR="$REPO_ROOT/.claude-bot"

DESTRUCTIVE=0

while [ $# -gt 0 ]; do
  case "$1" in
    -d|--destructive)
      DESTRUCTIVE=1
      shift
      ;;
    -h|--help)
      echo "Usage: infra/sync-home.sh [-d|--destructive]"
      echo ""
      echo "Syncs .claude-bot/ to the 'home' Azure Files share."
      echo "Dry run by default — pass -d to actually upload."
      echo ""
      echo "Options:"
      echo "  -d, --destructive   Actually upload (default is dry run)"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

if [ ! -d "$SOURCE_DIR" ]; then
  echo "❌ Source directory not found: $SOURCE_DIR" >&2
  exit 1
fi

if ! command -v azcopy >/dev/null 2>&1; then
  echo "❌ azcopy not found. Install it: https://learn.microsoft.com/azure/storage/common/storage-use-azcopy-v10" >&2
  exit 1
fi

# Generate a short-lived SAS token for the file share
echo "🔑 Generating SAS token..."
EXPIRY=$(date -u -d '+1 hour' '+%Y-%m-%dT%H:%MZ')
SAS=$(az storage account generate-sas \
  --account-name "$STORAGE_ACCOUNT" \
  --services f \
  --resource-types sco \
  --permissions rwlc \
  --expiry "$EXPIRY" \
  --output tsv)

DEST_URL="https://${STORAGE_ACCOUNT}.file.core.windows.net/${SHARE_NAME}/.claude?${SAS}"

if [ "$DESTRUCTIVE" = 1 ]; then
  echo "📤 Syncing .claude-bot to home/.claude on share..."
  echo "   Source: $SOURCE_DIR"
  echo "   Dest:   https://${STORAGE_ACCOUNT}.file.core.windows.net/${SHARE_NAME}/.claude"
  azcopy sync "$SOURCE_DIR" "$DEST_URL"
  echo "✅ Sync complete"
else
  echo "🔍 Dry run — showing what would be synced:"
  echo "   Source: $SOURCE_DIR"
  echo "   Dest:   https://${STORAGE_ACCOUNT}.file.core.windows.net/${SHARE_NAME}/.claude"
  azcopy sync "$SOURCE_DIR" "$DEST_URL" --dry-run
  echo ""
  echo "Run with -d to actually upload."
fi
