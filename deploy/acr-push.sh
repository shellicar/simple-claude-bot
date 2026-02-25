#!/bin/sh
# Build and push brain-azure image to Azure Container Registry
#
# Usage:
#   ./deploy/acr-push.sh [--tag <TAG>] [--build-only] [--no-deploy]
#
# Options:
#   --tag         Image tag (default: short image SHA)
#   --build-only  Build and tag without pushing to ACR
#   --no-deploy   Push to ACR but don't update the Container App

set -e

ACR="sghacraue01.azurecr.io"
IMAGE_NAME="banananet-brain"
CONTAINER_APP="sgh-ca-aue-dev-banananet-01"
RESOURCE_GROUP="sgh-rg-aue-dev-banananet-01"
TAG=""
BUILD_ONLY=0
NO_DEPLOY=0

while [ $# -gt 0 ]; do
  case "$1" in
    --tag)
      TAG="$2"
      shift 2
      ;;
    --build-only)
      BUILD_ONLY=1
      shift
      ;;
    --no-deploy)
      NO_DEPLOY=1
      shift
      ;;
    -h|--help)
      echo "Usage: ./deploy/acr-push.sh [--tag <TAG>] [--build-only] [--no-deploy]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

echo "🔨 Building ${IMAGE_NAME}..."
docker build -t "${IMAGE_NAME}:build" -f apps/brain-azure/Dockerfile .

if [ -z "$TAG" ]; then
  TAG=$(docker inspect "${IMAGE_NAME}:build" --format '{{.Id}}' | cut -c8-15)
fi

SHA_IMAGE="${ACR}/${IMAGE_NAME}:${TAG}"

echo "🏷️  Tagging as ${SHA_IMAGE}"
docker tag "${IMAGE_NAME}:build" "${SHA_IMAGE}"

if [ "$BUILD_ONLY" = 1 ]; then
  echo "✅ Build complete (--build-only, skipping push)"
  exit 0
fi

echo "🔐 Logging in to ACR..."
az acr login --name sghacraue01

echo "📤 Pushing ${SHA_IMAGE}..."
docker push "${SHA_IMAGE}"

echo "🏷️  Tagging latest → ${TAG} (server-side)..."
az acr import \
  --name sghacraue01 \
  --source "${ACR}/${IMAGE_NAME}:${TAG}" \
  --image "${IMAGE_NAME}:latest" \
  --force

echo "✅ Push complete: ${SHA_IMAGE} + latest"

if [ "$NO_DEPLOY" = 1 ]; then
  exit 0
fi

BUILD_TIME=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

echo "🚀 Updating Container App..."
az containerapp update \
  -n "${CONTAINER_APP}" \
  -g "${RESOURCE_GROUP}" \
  --image "${SHA_IMAGE}" \
  --set-env-vars \
    "BANANABOT_BUILD_HASH=${TAG}" \
    "BANANABOT_BUILD_TIME=${BUILD_TIME}"

echo "✅ Deploy complete: ${CONTAINER_APP} → ${SHA_IMAGE} (hash=${TAG}, time=${BUILD_TIME})"
