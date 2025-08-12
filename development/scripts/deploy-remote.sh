#!/bin/bash

# Deploy to Unraid - Remote Development Environment
# This deploys the full Supabase + Apps stack to your Unraid server

set -e

# Configuration
REMOTE_HOST="192.168.1.45"
REMOTE_USER="root"
REMOTE_PATH="/mnt/user/appdata/netneural-dev"
COMPOSE_FILE="docker-compose.yml"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY] $1${NC}"; }
info() { echo -e "${BLUE}[INFO] $1${NC}"; }
warn() { echo -e "${YELLOW}[WARN] $1${NC}"; }
error() { echo -e "${RED}[ERROR] $1${NC}"; exit 1; }

show_help() {
    echo "Deploy NetNeural SoftwareMono to Unraid"
    echo ""
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  full       Deploy full stack (Supabase + Apps)"
    echo "  apps       Deploy only apps (assumes Supabase running)"
    echo "  supabase   Deploy only Supabase stack"
    echo "  stop       Stop remote services"
    echo "  status     Check remote service status"
    echo "  logs       Show remote service logs"
    echo "  help       Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 full      # Deploy everything to Unraid"
    echo "  $0 apps      # Deploy only your apps"
    echo "  $0 status    # Check what's running on Unraid"
}

check_local_docker() {
    if ! docker info > /dev/null 2>&1; then
        error "Docker Desktop is not running locally. Please start Docker Desktop."
    fi
}

check_remote_connection() {
    if ! ssh "$REMOTE_USER@$REMOTE_HOST" "echo 'Connected'" > /dev/null 2>&1; then
        error "Cannot connect to $REMOTE_HOST. Check SSH connection."
    fi
}

build_images_locally() {
    log "Building images locally..."
    
    # Clear any remote docker host settings
    unset DOCKER_HOST
    
    # Build your application images
    docker compose --profile development build web api
    
    log "Images built successfully"
}

transfer_images() {
    log "Transferring images to Unraid..."
    
    # Get built images
    IMAGES=$(docker compose --profile development images web api --quiet)
    
    if [ -z "$IMAGES" ]; then
        error "No images found to transfer. Run build first."
    fi
    
    # Create temp directory
    TEMP_DIR=$(mktemp -d)
    trap "rm -rf $TEMP_DIR" EXIT
    
    # Save images as tarballs
    for IMAGE in $IMAGES; do
        IMAGE_NAME=$(docker inspect --format='{{index .RepoTags 0}}' "$IMAGE" 2>/dev/null || echo "unknown:latest")
        SAFE_NAME=$(echo "$IMAGE_NAME" | sed 's/[^a-zA-Z0-9._-]/_/g')
        TARBALL="$TEMP_DIR/${SAFE_NAME}.tar"
        
        info "Saving $IMAGE_NAME..."
        docker save -o "$TARBALL" "$IMAGE"
    done
    
    # Transfer to remote
    info "Transferring files to $REMOTE_HOST..."
    scp "$TEMP_DIR"/*.tar "$REMOTE_USER@$REMOTE_HOST:/tmp/"
    
    # Load images on remote
    log "Loading images on remote server..."
    ssh "$REMOTE_USER@$REMOTE_HOST" << 'EOF'
        for tarball in /tmp/*.tar; do
            if [ -f "$tarball" ]; then
                echo "Loading $(basename "$tarball")..."
                docker load -i "$tarball"
                rm "$tarball"
            fi
        done
EOF
}

deploy_full_stack() {
    log "Deploying full stack to Unraid..."
    
    check_local_docker
    check_remote_connection
    
    # Build and transfer custom images
    build_images_locally
    transfer_images
    
    # Create remote environment file
    create_remote_env
    
    # Transfer Docker Compose file
    log "Transferring deployment configuration..."
    ssh "$REMOTE_USER@$REMOTE_HOST" "mkdir -p $REMOTE_PATH"
    scp "$COMPOSE_FILE" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/"
    scp ".env.remote" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/.env"
    
    # Deploy on remote
    log "Starting services on Unraid..."
    ssh "$REMOTE_USER@$REMOTE_HOST" << EOF
        cd $REMOTE_PATH
        
        # Stop any existing services
        docker compose down --remove-orphans || true
        
        # Start full stack
        docker compose --profile full-supabase --profile development up -d
        
        # Wait a moment for services to start
        sleep 5
        
        # Show status
        echo ""
        echo "=== Service Status ==="
        docker compose ps
EOF
    
    show_remote_urls
}

deploy_apps_only() {
    log "Deploying only applications to Unraid..."
    
    check_local_docker
    check_remote_connection
    
    build_images_locally
    transfer_images
    create_remote_env
    
    # Transfer files
    ssh "$REMOTE_USER@$REMOTE_HOST" "mkdir -p $REMOTE_PATH"
    scp "$COMPOSE_FILE" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/"
    scp ".env.remote" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/.env"
    
    # Deploy apps only
    log "Starting applications on Unraid..."
    ssh "$REMOTE_USER@$REMOTE_HOST" << EOF
        cd $REMOTE_PATH
        
        # Stop any existing app services
        docker compose stop web api || true
        docker compose rm -f web api || true
        
        # Start apps
        docker compose --profile development up -d web api
        
        # Show status
        echo ""
        echo "=== Service Status ==="
        docker compose ps
EOF
    
    show_remote_urls
}

deploy_supabase_only() {
    log "Deploying only Supabase stack to Unraid..."
    
    check_remote_connection
    create_remote_env
    
    # Transfer files
    ssh "$REMOTE_USER@$REMOTE_HOST" "mkdir -p $REMOTE_PATH"
    scp "$COMPOSE_FILE" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/"
    scp ".env.remote" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/.env"
    
    # Deploy Supabase only
    log "Starting Supabase stack on Unraid..."
    ssh "$REMOTE_USER@$REMOTE_HOST" << EOF
        cd $REMOTE_PATH
        
        # Stop any existing Supabase services
        docker compose --profile full-supabase down || true
        
        # Start Supabase stack
        docker compose --profile full-supabase up -d
        
        # Show status
        echo ""
        echo "=== Service Status ==="
        docker compose ps
EOF
    
    show_remote_urls
}

create_remote_env() {
    log "Creating remote environment configuration..."
    
    cat > .env.remote << EOF
# NetNeural SoftwareMono - Remote Development Environment
SUPABASE_URL=http://$REMOTE_HOST:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
NODE_ENV=development
EOF
}

stop_remote() {
    log "Stopping remote services..."
    
    check_remote_connection
    
    ssh "$REMOTE_USER@$REMOTE_HOST" << EOF
        cd $REMOTE_PATH 2>/dev/null || exit 0
        
        echo "Stopping all services..."
        docker compose down --remove-orphans
        
        echo "Services stopped"
EOF
}

show_remote_status() {
    log "Checking remote service status..."
    
    check_remote_connection
    
    ssh "$REMOTE_USER@$REMOTE_HOST" << EOF
        cd $REMOTE_PATH 2>/dev/null || {
            echo "❌ No deployment found in $REMOTE_PATH"
            exit 1
        }
        
        echo "=== Service Status ==="
        docker compose ps
        
        echo ""
        echo "=== Service Health ==="
        
        # Check Supabase API
        if curl -s http://localhost:54321/health > /dev/null 2>&1; then
            echo "✅ Supabase API: Running"
        else
            echo "❌ Supabase API: Not responding"
        fi
        
        # Check your apps
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            echo "✅ Web App: Running"
        else
            echo "❌ Web App: Not responding"
        fi
        
        if curl -s http://localhost:3001 > /dev/null 2>&1; then
            echo "✅ API: Running"
        else
            echo "❌ API: Not responding"
        fi
EOF
    
    show_remote_urls
}

show_remote_logs() {
    log "Showing remote service logs..."
    
    check_remote_connection
    
    ssh "$REMOTE_USER@$REMOTE_HOST" << EOF
        cd $REMOTE_PATH 2>/dev/null || {
            echo "❌ No deployment found in $REMOTE_PATH"
            exit 1
        }
        
        docker compose logs -f
EOF
}

show_remote_urls() {
    echo ""
    echo "🚀 Remote Development Environment URLs:"
    echo ""
    echo "📊 Supabase Studio:    http://$REMOTE_HOST:54323"
    echo "🔗 Supabase API:       http://$REMOTE_HOST:54321"
    echo "🌐 Your Web App:       http://$REMOTE_HOST:3000"
    echo "⚡ Your API:           http://$REMOTE_HOST:3001"
    echo "📧 Email Testing:      http://$REMOTE_HOST:54326"
    echo ""
    echo "💡 Use '$0 stop' to stop remote services"
    echo "💡 Use '$0 status' to check remote status"
    echo "💡 Use '$0 logs' to view remote logs"
}

# Main logic
case "${1:-help}" in
    "full")
        deploy_full_stack
        ;;
    "apps")
        deploy_apps_only
        ;;
    "supabase")
        deploy_supabase_only
        ;;
    "stop")
        stop_remote
        ;;
    "status")
        show_remote_status
        ;;
    "logs")
        show_remote_logs
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        echo "Unknown option: $1"
        show_help
        exit 1
        ;;
esac
