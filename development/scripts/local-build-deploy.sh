#!/bin/bash

# Local Build and Remote Deploy Script for NetNeural SoftwareMono
# This script builds Docker images locally and deploys them to the remote Unraid server
# Usage: ./local-build-deploy.sh [service-name]

set -e  # Exit on any error

# Configuration
REMOTE_HOST="192.168.1.45"
REMOTE_USER="root"
PROJECT_NAME="netneural-softwaremono"
COMPOSE_FILE="docker-compose.yml"
REMOTE_PROJECT_PATH="/mnt/user/appdata/softwaremono"  # Adjust for your Unraid setup

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Check if Docker is running locally
if ! docker info > /dev/null 2>&1; then
    error "Docker is not running locally. Please start Docker Desktop."
fi

# Check if we're in the right directory
if [ ! -f "$COMPOSE_FILE" ]; then
    error "Docker Compose file '$COMPOSE_FILE' not found! Please run this script from the development directory."
fi

# Build packages first (for monorepo)
log "Building workspace packages..."
npm run build --workspaces --if-present || warn "Some workspace builds may have failed - continuing with Docker build"

# Determine what to build
SERVICE_NAME=""
if [ $# -eq 1 ]; then
    SERVICE_NAME="$1"
    log "Building service: $SERVICE_NAME"
else
    log "Building all services"
fi

# Build locally
log "Building images locally..."
if [ -n "$SERVICE_NAME" ]; then
    docker compose -f "$COMPOSE_FILE" build "$SERVICE_NAME"
else
    docker compose -f "$COMPOSE_FILE" build
fi

# Get list of images to transfer
log "Getting list of built images..."
if [ -n "$SERVICE_NAME" ]; then
    IMAGES=$(docker compose -f "$COMPOSE_FILE" config --services | grep "^$SERVICE_NAME$" | xargs -I {} docker compose -f "$COMPOSE_FILE" images {} --quiet)
else
    IMAGES=$(docker compose -f "$COMPOSE_FILE" images --quiet)
fi

if [ -z "$IMAGES" ]; then
    error "No images found to transfer"
fi

# Create temporary directory for tarballs
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

log "Created temporary directory: $TEMP_DIR"

# Save each image as tarball
for IMAGE in $IMAGES; do
    IMAGE_NAME=$(docker inspect --format='{{index .RepoTags 0}}' "$IMAGE" 2>/dev/null || echo "unknown:latest")
    SAFE_NAME=$(echo "$IMAGE_NAME" | sed 's/[^a-zA-Z0-9._-]/_/g')
    TARBALL="$TEMP_DIR/${SAFE_NAME}.tar"
    
    log "Saving image $IMAGE_NAME to $TARBALL..."
    docker save -o "$TARBALL" "$IMAGE"
done

# Transfer tarballs to remote system
log "Transferring images to remote system..."
scp "$TEMP_DIR"/*.tar "$REMOTE_USER@$REMOTE_HOST:/tmp/"

# Load images on remote system
log "Loading images on remote system..."
for TARBALL in "$TEMP_DIR"/*.tar; do
    FILENAME=$(basename "$TARBALL")
    ssh "$REMOTE_USER@$REMOTE_HOST" "docker load -i /tmp/$FILENAME && rm /tmp/$FILENAME"
done

# Deploy with docker compose on remote system
log "Transferring compose file and deployment assets to remote system..."
ssh "$REMOTE_USER@$REMOTE_HOST" "mkdir -p $REMOTE_PROJECT_PATH"
scp "$COMPOSE_FILE" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PROJECT_PATH/"
if [ -f ".env" ]; then
    scp ".env" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PROJECT_PATH/"
fi
if [ -f ".env.production" ]; then
    scp ".env.production" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PROJECT_PATH/.env"
fi

log "Deploying services on remote system..."
if [ -n "$SERVICE_NAME" ]; then
    ssh "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_PROJECT_PATH && docker compose up -d $SERVICE_NAME"
else
    ssh "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_PROJECT_PATH && docker compose up -d"
fi

log "Deployment complete!"
log "Images transferred and loaded successfully on $REMOTE_HOST"
