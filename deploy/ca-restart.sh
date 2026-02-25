#!/bin/sh
# Restart the active Container App revision to force a new instance
#
# Usage:
#   ./deploy/ca-restart.sh

set -e

CONTAINER_APP="sgh-ca-aue-dev-banananet-01"
RESOURCE_GROUP="sgh-rg-aue-dev-banananet-01"

REVISION=$(az containerapp revision list \
  -n "${CONTAINER_APP}" \
  -g "${RESOURCE_GROUP}" \
  --query "[?properties.active].name | [0]" \
  -o tsv)

if [ -z "$REVISION" ]; then
  echo "No active revision found" >&2
  exit 1
fi

echo "Restarting revision: ${REVISION}"
az containerapp revision restart \
  -n "${CONTAINER_APP}" \
  -g "${RESOURCE_GROUP}" \
  --revision "${REVISION}"

echo "Restart triggered: ${REVISION}"
