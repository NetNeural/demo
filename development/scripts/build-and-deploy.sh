#!/bin/bash

# Build and Deploy Script for Remote Docker
# Works with legacy Docker build system

set -e

IMAGE_NAME="${1:-netneural-app}"
IMAGE_TAG="${2:-latest}"
REMOTE_HOST="${3:-192.168.1.45}"

echo "🏗️  Building image locally: ${IMAGE_NAME}:${IMAGE_TAG}"

# Step 1: Ensure we're building locally (unset DOCKER_HOST)
unset DOCKER_HOST
export DOCKER_CONTEXT=default

# Step 2: Build the image locally using legacy Docker build
docker build -t "${IMAGE_NAME}:${IMAGE_TAG}" .

echo "📦 Saving image to tarball..."

# Step 3: Save the image to a tarball
docker save "${IMAGE_NAME}:${IMAGE_TAG}" > "/tmp/${IMAGE_NAME}-${IMAGE_TAG}.tar"

echo "🚀 Transferring image to remote host..."

# Step 4: Transfer the tarball to remote host
scp "/tmp/${IMAGE_NAME}-${IMAGE_TAG}.tar" "root@${REMOTE_HOST}:/tmp/"

echo "📥 Loading image on remote host..."

# Step 5: Load the image on the remote Docker daemon
ssh "root@${REMOTE_HOST}" "docker load < /tmp/${IMAGE_NAME}-${IMAGE_TAG}.tar"

echo "🧹 Cleaning up..."

# Step 6: Clean up local tarball
rm "/tmp/${IMAGE_NAME}-${IMAGE_TAG}.tar"

# Step 7: Clean up remote tarball
ssh "root@${REMOTE_HOST}" "rm /tmp/${IMAGE_NAME}-${IMAGE_TAG}.tar"

echo "✅ Image ${IMAGE_NAME}:${IMAGE_TAG} successfully deployed to ${REMOTE_HOST}"

# Step 8: Verify the image is available remotely
echo "🔍 Verifying deployment..."
ssh "root@${REMOTE_HOST}" "docker images | grep ${IMAGE_NAME}"
