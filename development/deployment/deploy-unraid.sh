#!/bin/bash

# NetNeural Unraid Deployment Script
# This script deploys NetNeural to your Unraid server with dedicated ports

set -e

echo "🚀 Deploying NetNeural to Unraid Server"
echo "========================================"

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

# Configuration
UNRAID_IP="192.168.1.45"
DOCKER_HOST="tcp://${UNRAID_IP}:2375"

# Check if environment file exists
print_step "Checking environment configuration..."
if [ ! -f .env.unraid ]; then
    if [ -f .env.local.example ]; then
        cp .env.local.example .env.unraid
        print_warning "Created .env.unraid from .env.local.example. Please update the configuration!"
        print_error "You must update .env.unraid with secure passwords before deploying!"
        echo "Edit .env.unraid and run this script again."
        exit 1
    else
        print_error ".env.local.example not found. Please create environment configuration."
        exit 1
    fi
fi

print_success "Environment configuration found"

# Test Docker connection to Unraid
print_step "Testing connection to Unraid server ($UNRAID_IP)..."
export DOCKER_HOST="$DOCKER_HOST"

if ! docker version &> /dev/null; then
    print_error "Cannot connect to Docker on Unraid server"
    print_error "Make sure:"
    print_error "1. Unraid server is accessible at $UNRAID_IP"
    print_error "2. Docker daemon is running on port 2375"
    print_error "3. No firewall is blocking the connection"
    exit 1
fi

print_success "Connected to Unraid Docker daemon"

# Check for port conflicts
print_step "Checking for port conflicts..."
NETNEURAL_PORTS=(4000 4001 4432 4433 4434 4435 4436 4437 4379 4080 4081 4443)
CONFLICTING_PORTS=()

for port in "${NETNEURAL_PORTS[@]}"; do
    if docker ps --format "table {{.Names}}\t{{.Ports}}" | grep -q ":${port}->"; then
        CONFLICTING_PORTS+=($port)
    fi
done

if [ ${#CONFLICTING_PORTS[@]} -gt 0 ]; then
    print_warning "The following NetNeural ports are already in use:"
    for port in "${CONFLICTING_PORTS[@]}"; do
        echo "   Port $port: $(docker ps --format "table {{.Names}}\t{{.Ports}}" | grep ":${port}->")"
    done
    echo ""
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Deployment cancelled due to port conflicts"
        exit 1
    fi
fi

print_success "Port conflict check completed"

# Create Docker network if it doesn't exist
print_step "Setting up Docker network..."
if ! docker network ls | grep -q "netneural-unraid"; then
    docker network create netneural-unraid
    print_success "Created netneural-unraid Docker network"
else
    print_success "netneural-unraid Docker network already exists"
fi

# Pull latest images
print_step "Pulling latest Docker images..."
docker-compose -f ../docker/docker-compose.unraid.yml --env-file .env.unraid pull

# Deploy NetNeural stack
print_step "Deploying NetNeural stack to Unraid..."
docker-compose -f ../docker/docker-compose.unraid.yml --env-file .env.unraid up -d --build

# Wait for services to start
print_step "Waiting for services to start..."
sleep 15

# Check service health
print_step "Checking service health..."
echo ""
echo "Service Status:"
docker-compose -f ../docker/docker-compose.unraid.yml --env-file .env.unraid ps

# Test database connection
print_step "Testing database connection..."
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if docker exec netneural-postgres-unraid pg_isready -U postgres > /dev/null 2>&1; then
        print_success "Database is healthy"
        break
    fi
    attempt=$((attempt + 1))
    echo "Waiting for database... ($attempt/$max_attempts)"
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    print_warning "Database health check timed out"
fi

# Show deployment summary
echo ""
echo "🎉 NetNeural Unraid Deployment Complete!"
echo "========================================"
echo ""
echo "📍 NetNeural Service URLs (Unraid):"
echo "   🌐 NetNeural Web App:    http://${UNRAID_IP}:4000"
echo "   🛠️ Supabase Studio:      http://${UNRAID_IP}:4001"
echo "   🔗 API (PostgREST):      http://${UNRAID_IP}:4434"
echo "   🔐 Auth (GoTrue):        http://${UNRAID_IP}:4433"
echo "   💾 Storage API:          http://${UNRAID_IP}:4436"
echo "   ⚡ Realtime:             ws://${UNRAID_IP}:4435"
echo "   🗄️ PostgreSQL:           ${UNRAID_IP}:4432"
echo "   📊 Redis:                ${UNRAID_IP}:4379"
echo "   🔄 Traefik Dashboard:    http://${UNRAID_IP}:4080"
echo ""
echo "🔧 Management Commands:"
echo "   Stop NetNeural:         docker-compose -f docker/docker-compose.unraid.yml --env-file .env.unraid down"
echo "   View logs:              docker-compose -f docker/docker-compose.unraid.yml --env-file .env.unraid logs -f"
echo "   Restart services:       docker-compose -f docker/docker-compose.unraid.yml --env-file .env.unraid restart"
echo ""
echo "📊 Existing SynapticDrift Services (No Conflicts):"
echo "   🌐 SynapticDrift Web:    http://${UNRAID_IP}:3000"
echo "   🔐 SynapticDrift Auth:   http://${UNRAID_IP}:9999"
echo "   🗄️ SynapticDrift DB:     ${UNRAID_IP}:5432"
echo "   📊 SynapticDrift Redis:  ${UNRAID_IP}:6379"
echo "   🔄 SynapticDrift Traefik: http://${UNRAID_IP}:9090"
echo ""
print_success "NetNeural is now running alongside SynapticDrift with no conflicts!"
print_warning "Remember to configure your domain/DNS if you plan to use custom domains"
