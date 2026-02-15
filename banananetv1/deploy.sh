#!/bin/sh
# Deploy banananet containers with image metadata
#
# Usage:
#   ./banananetv1/deploy.sh

set -e

DEPLOY_DIR="banananetv1"
COMPOSE_FILE="$DEPLOY_DIR/compose.yaml"
BRAIN_ENV="$DEPLOY_DIR/brain.env"
EARS_ENV="$DEPLOY_DIR/ears.env"

# Extract and write metadata for each image
for image_env in "banananet-brain:$BRAIN_ENV" "banananet-ears:$EARS_ENV"; do
  IMAGE="${image_env%%:*}"
  ENV_FILE="${image_env#*:}"

  BUILD_TIME=$(docker inspect "$IMAGE" --format '{{.Created}}')
  BUILD_HASH=$(docker inspect "$IMAGE" --format '{{.Id}}' | cut -c8-19)

  sed -i '/^BANANABOT_BUILD_TIME=/d' "$ENV_FILE" 2>/dev/null || true
  sed -i '/^BANANABOT_BUILD_HASH=/d' "$ENV_FILE" 2>/dev/null || true
  printf 'BANANABOT_BUILD_TIME=%s\n' "$BUILD_TIME" >> "$ENV_FILE"
  printf 'BANANABOT_BUILD_HASH=%s\n' "$BUILD_HASH" >> "$ENV_FILE"

  echo "   $IMAGE: $BUILD_HASH built $BUILD_TIME"
done

echo "🚀 Starting containers..."
docker compose -f "$COMPOSE_FILE" up -d

echo "✅ Deploy complete"
