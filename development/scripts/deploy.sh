#!/bin/bash

# Quick Deploy Script for NetNeural SoftwareMono
# This script builds and deploys your application to the Unraid server
# Usage: ./deploy.sh [web|api|all]

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY] $1${NC}"; }
warn() { echo -e "${YELLOW}[WARN] $1${NC}"; }
error() { echo -e "${RED}[ERROR] $1${NC}"; exit 1; }

# Configuration
REMOTE_HOST="192.168.1.45"
REMOTE_USER="root"
REMOTE_PATH="/mnt/user/appdata/netneural-softwaremono"
COMPOSE_FILE="docker-compose.production.yml"

# Default to building all services
SERVICE="${1:-all}"

log "Starting deployment of $SERVICE to $REMOTE_HOST..."

# Check Docker is running
if ! docker info > /dev/null 2>&1; then
    error "Docker Desktop is not running. Please start Docker Desktop first."
fi

# Build locally
log "Building images locally..."
if [ "$SERVICE" = "all" ]; then
    docker compose -f "$COMPOSE_FILE" build
elif [ "$SERVICE" = "web" ] || [ "$SERVICE" = "api" ]; then
    docker compose -f "$COMPOSE_FILE" build "$SERVICE"
else
    error "Invalid service. Use: web, api, or all"
fi

# Get built images
log "Preparing images for transfer..."
if [ "$SERVICE" = "all" ]; then
    IMAGES=$(docker compose -f "$COMPOSE_FILE" images --quiet)
else
    IMAGES=$(docker compose -f "$COMPOSE_FILE" images "$SERVICE" --quiet)
fi

# Create temp directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Save images
for IMAGE in $IMAGES; do
    IMAGE_NAME=$(docker inspect --format='{{index .RepoTags 0}}' "$IMAGE" 2>/dev/null || echo "unknown:latest")
    SAFE_NAME=$(echo "$IMAGE_NAME" | sed 's/[^a-zA-Z0-9._-]/_/g')
    TARBALL="$TEMP_DIR/${SAFE_NAME}.tar"
    
    log "Saving $IMAGE_NAME..."
    docker save -o "$TARBALL" "$IMAGE"
done

# Transfer to remote
log "Transferring to remote server..."
scp "$TEMP_DIR"/*.tar "$REMOTE_USER@$REMOTE_HOST:/tmp/"
scp "$COMPOSE_FILE" "$REMOTE_USER@$REMOTE_HOST:/tmp/"

# Create environment file if it doesn't exist
if [ ! -f ".env.production" ]; then
    warn "No .env.production found. Creating template..."
    cat > .env.production << EOF
# Production Environment Variables
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NODE_ENV=production
EOF
    warn "Please edit .env.production with your actual values"
fi

scp ".env.production" "$REMOTE_USER@$REMOTE_HOST:/tmp/.env"

# Deploy on remote
log "Deploying on remote server..."
ssh "$REMOTE_USER@$REMOTE_HOST" << EOF
    # Create project directory
    mkdir -p $REMOTE_PATH
    cd $REMOTE_PATH
    
    # Load images
    for tarball in /tmp/*.tar; do
        [ -f "\$tarball" ] && docker load -i "\$tarball" && rm "\$tarball"
    done
    
    # Copy deployment files
    cp /tmp/$COMPOSE_FILE ./docker-compose.yml
    cp /tmp/.env ./
    rm /tmp/.env /tmp/$COMPOSE_FILE
    
    # Deploy services
    if [ "$SERVICE" = "all" ]; then
        docker compose up -d
    else
        docker compose up -d $SERVICE
    fi
    
    # Show status
    docker compose ps
EOF

log "Deployment complete!"
log "Your application should be running on http://$REMOTE_HOST:3000"
