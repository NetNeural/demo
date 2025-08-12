#!/bin/bash

# NetNeural Development Environment Setup
# This script sets up the complete Supabase-based development environment

set -e

echo "🚀 Setting up NetNeural Development Environment"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Docker is installed and running
print_step "Checking Docker installation..."
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! docker info &> /dev/null; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

print_success "Docker is installed and running"

# Check if docker-compose is available
print_step "Checking Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    if ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not available. Please install Docker Compose."
        exit 1
    else
        DOCKER_COMPOSE_CMD="docker compose"
    fi
else
    DOCKER_COMPOSE_CMD="docker-compose"
fi

print_success "Docker Compose is available"

# Set up environment file
print_step "Setting up environment configuration..."
if [ ! -f .env.local ]; then
    if [ -f .env.local.example ]; then
        cp .env.local.example .env.local
        print_warning "Created .env.local from .env.local.example. Please review and update the configuration."
        print_warning "Important: Update Supabase URL and keys in .env.local before running!"
    else
        print_error ".env.local.example not found. Please create environment configuration."
        exit 1
    fi
else
    print_success ".env.local already exists"
fi

# Create necessary directories
print_step "Creating necessary directories..."
mkdir -p apps/web/src
mkdir -p apps/api/src
mkdir -p apps/mobile/src
mkdir -p packages/supabase/src
mkdir -p packages/types/src
mkdir -p packages/ui/src
mkdir -p packages/utils/src
print_success "Directories created"

# Initialize Supabase project
print_step "Initializing Supabase project..."
if [ ! -d "supabase" ]; then
    print_step "Creating Supabase configuration directory..."
    mkdir -p supabase/migrations
    mkdir -p supabase/functions
    
    # Create basic Supabase config
    cat > supabase/config.toml << 'EOF'
# NetNeural Supabase Configuration

project_id = "netneural-dev"

[api]
enabled = true
port = 54321
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

[auth]
enabled = true
port = 54324
site_url = "http://localhost:3000"
additional_redirect_urls = ["https://localhost:3000"]
jwt_expiry = 3600
enable_signup = true

[storage]
enabled = true
port = 54325
file_size_limit = "50MiB"
buckets = []

[db]
port = 54322
major_version = 15

[studio]
enabled = true
port = 54323
EOF

    print_success "Supabase configuration created"
else
    print_success "Supabase directory already exists"
fi

# Build Docker images
print_step "Building Docker images..."
echo "This may take a few minutes..."

# Start with Supabase services first
print_step "Starting Supabase services..."
$DOCKER_COMPOSE_CMD -f ../docker/docker-compose.local.yml up -d supabase-db supabase-auth supabase-rest supabase-storage supabase-realtime

# Wait for Supabase to be ready
print_step "Waiting for Supabase services to be ready..."
sleep 15

# Check if Supabase database is responding
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if curl -f http://localhost:54323/api/profile >/dev/null 2>&1; then
        print_success "Supabase services are ready"
        break
    fi
    attempt=$((attempt + 1))
    echo "Waiting for Supabase... ($attempt/$max_attempts)"
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    print_warning "Supabase health check timed out - continuing anyway"
fi

# Start the rest of the services
print_step "Starting all NetNeural services..."
$DOCKER_COMPOSE_CMD -f ../docker/docker-compose.local.yml up -d

# Wait a bit for services to start
sleep 5

# Show status
print_step "Checking service status..."
$DOCKER_COMPOSE_CMD -f ../docker/docker-compose.local.yml ps

echo ""
echo "🎉 NetNeural Development Environment Setup Complete!"
echo "=================================================="
echo ""
echo "📍 Service URLs:"
echo "   🌐 NetNeural Web App:    http://localhost:4000"
echo "   🛠️ Supabase Studio:      http://localhost:4001"
echo "   🔗 API (PostgREST):      http://localhost:4434"
echo "   🔐 Auth (GoTrue):        http://localhost:4433"
echo "   💾 Storage API:          http://localhost:4436"
echo "   ⚡ Realtime:             ws://localhost:4435"
echo "   🗄️ PostgreSQL:           localhost:4432"
echo "   📊 Redis:                localhost:4379"
echo "   🔄 Traefik Dashboard:    http://localhost:4080"
echo ""
echo "🔧 Management Commands:"
echo "   Stop all services:       $DOCKER_COMPOSE_CMD -f docker/docker-compose.local.yml down"
echo "   View logs:              $DOCKER_COMPOSE_CMD -f docker/docker-compose.local.yml logs -f"
echo "   Restart services:       $DOCKER_COMPOSE_CMD -f docker/docker-compose.local.yml restart"
echo ""
echo "📚 Next Steps:"
echo "   1. Update .env.local with your configuration"
echo "   2. Access Supabase Studio at http://localhost:4001"
echo "   3. Start developing your NetNeural application!"
echo ""
print_warning "Remember to update passwords and secrets in .env.local for production use!"
