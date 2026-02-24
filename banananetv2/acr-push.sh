#!/bin/sh
# Build and push brain-azure image to Azure Container Registry
#
# Usage:
#   ./banananetv2/acr-push.sh [--tag <TAG>] [--build-only] [--no-deploy]
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
      echo "Usage: ./banananetv2/acr-push.sh [--tag <TAG>] [--build-only] [--no-deploy]"
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
LATEST_IMAGE="${ACR}/${IMAGE_NAME}:latest"

echo "🏷️  Tagging as ${SHA_IMAGE}"
docker tag "${IMAGE_NAME}:build" "${SHA_IMAGE}"

echo "🏷️  Tagging as ${LATEST_IMAGE}"
docker tag "${IMAGE_NAME}:build" "${LATEST_IMAGE}"

if [ "$BUILD_ONLY" = 1 ]; then
  echo "✅ Build complete (--build-only, skipping push)"
  exit 0
fi

echo "🔐 Logging in to ACR..."
az acr login --name sghacraue01

echo "📤 Pushing ${SHA_IMAGE}..."
docker push "${SHA_IMAGE}"

echo "📤 Pushing ${LATEST_IMAGE}..."
docker push "${LATEST_IMAGE}"

echo "✅ Push complete: ${SHA_IMAGE} + latest"

if [ "$NO_DEPLOY" = 1 ]; then
  exit 0
fi

echo "🚀 Updating Container App..."
az containerapp update \
  -n "${CONTAINER_APP}" \
  -g "${RESOURCE_GROUP}" \
  --image "${SHA_IMAGE}"

echo "✅ Deploy complete: ${CONTAINER_APP} → ${SHA_IMAGE}"
