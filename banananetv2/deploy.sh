#!/bin/sh
# Deploy banananet v2 (ears only, brain is Azure Functions)
#
# Usage:
#   ./banananetv2/deploy.sh

set -e

DEPLOY_DIR="banananetv2"
COMPOSE_FILE="$DEPLOY_DIR/compose.yaml"
EARS_ENV="$DEPLOY_DIR/ears.env"

IMAGE="banananet-ears"

BUILD_TIME=$(docker inspect "$IMAGE" --format '{{.Created}}')
BUILD_HASH=$(docker inspect "$IMAGE" --format '{{.Id}}' | cut -c8-19)

sed -i '/^BANANABOT_BUILD_TIME=/d' "$EARS_ENV" 2>/dev/null || true
sed -i '/^BANANABOT_BUILD_HASH=/d' "$EARS_ENV" 2>/dev/null || true
printf 'BANANABOT_BUILD_TIME=%s\n' "$BUILD_TIME" >> "$EARS_ENV"
printf 'BANANABOT_BUILD_HASH=%s\n' "$BUILD_HASH" >> "$EARS_ENV"

echo "   $IMAGE: $BUILD_HASH built $BUILD_TIME"

echo "Starting container..."
docker compose -f "$COMPOSE_FILE" up -d

echo "Deploy complete"
