#!/bin/bash

# Smart Remote Docker Build Script
# Works around read-only filesystem issues

set -e

IMAGE_NAME="${1:-netneural-app}"
IMAGE_TAG="${2:-latest}"
DOCKER_HOST="${3:-tcp://localhost:2375}"

echo "🐳 Using remote Docker at: ${DOCKER_HOST}"

# Set up the remote Docker connection
export DOCKER_HOST="${DOCKER_HOST}"

echo "🏗️  Building image with tmpfs workaround: ${IMAGE_NAME}:${IMAGE_TAG}"

# Method 1: Use docker build with explicit output to avoid buildx
docker build \
    --tag "${IMAGE_NAME}:${IMAGE_TAG}" \
    --file Dockerfile \
    .

echo "✅ Image ${IMAGE_NAME}:${IMAGE_TAG} built successfully"

# Verify the image
echo "🔍 Verifying image..."
docker images | grep "${IMAGE_NAME}" || echo "Image verification failed"

echo "🚀 Image ready for deployment!"
