#!/bin/sh
# Build and push brain-azure image to Azure Container Registry
#
# Usage:
#   ./banananetv2/acr-push.sh [--tag <TAG>] [--build-only]
#
# Options:
#   --tag         Image tag (default: latest)
#   --build-only  Build and tag without pushing to ACR

set -e

ACR="sghacraue01.azurecr.io"
IMAGE_NAME="banananet-brain"
TAG="latest"
BUILD_ONLY=0

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
    -h|--help)
      echo "Usage: ./banananetv2/acr-push.sh [--tag <TAG>] [--build-only]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

FULL_IMAGE="${ACR}/${IMAGE_NAME}:${TAG}"

echo "🔨 Building ${IMAGE_NAME}..."
docker build -t "${IMAGE_NAME}:${TAG}" -f apps/brain-azure/Dockerfile .

echo "🏷️  Tagging as ${FULL_IMAGE}"
docker tag "${IMAGE_NAME}:${TAG}" "${FULL_IMAGE}"

if [ "$BUILD_ONLY" = 1 ]; then
  echo "✅ Build complete (--build-only, skipping push)"
  exit 0
fi

echo "🔐 Logging in to ACR..."
az acr login --name sghacraue01

echo "📤 Pushing ${FULL_IMAGE}..."
docker push "${FULL_IMAGE}"

echo "✅ Push complete: ${FULL_IMAGE}"
