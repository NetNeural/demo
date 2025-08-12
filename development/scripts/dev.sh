#!/bin/bash

# Start Local Development Environment
# This script provides different ways to run your development environment

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEV] $1${NC}"; }
info() { echo -e "${BLUE}[INFO] $1${NC}"; }
warn() { echo -e "${YELLOW}[WARN] $1${NC}"; }

show_help() {
    echo "NetNeural SoftwareMono - Local Development"
    echo ""
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  cli        Use Supabase CLI + Docker Compose (Recommended)"
    echo "  compose    Use full Docker Compose stack"
    echo "  apps-only  Start only your apps (assumes Supabase is running)"
    echo "  stop       Stop all services"
    echo "  status     Show running services"
    echo "  logs       Show logs from all services"
    echo "  help       Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 cli      # Start Supabase via CLI, then your apps"
    echo "  $0 compose  # Start everything via Docker Compose"
    echo "  $0 stop     # Stop everything"
}

check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo "❌ Docker is not running. Please start Docker Desktop."
        exit 1
    fi
}

check_supabase_cli() {
    if ! command -v npx > /dev/null 2>&1; then
        echo "❌ npx not found. Please install Node.js."
        exit 1
    fi
}

start_with_cli() {
    log "Starting development with Supabase CLI..."
    
    check_docker
    check_supabase_cli
    
    # Check if Supabase is already running
    if curl -s http://localhost:54321/health > /dev/null 2>&1; then
        info "Supabase is already running"
    else
        log "Starting Supabase stack..."
        npx supabase start
    fi
    
    log "Starting your applications..."
    docker compose --profile development up -d web api
    
    show_urls
}

start_with_compose() {
    log "Starting everything with Docker Compose..."
    
    check_docker
    
    log "Starting full Supabase + Apps stack..."
    docker compose --profile full-supabase --profile development up -d
    
    # Wait for services to be ready
    log "Waiting for services to be ready..."
    sleep 10
    
    show_urls
}

start_apps_only() {
    log "Starting only your applications..."
    
    check_docker
    
    # Check if Supabase is running
    if ! curl -s http://localhost:54321/health > /dev/null 2>&1; then
        warn "Supabase doesn't seem to be running on localhost:54321"
        warn "Please start Supabase first with 'npx supabase start' or use '$0 cli'"
    fi
    
    docker compose --profile development up -d web api
    
    show_urls
}

stop_all() {
    log "Stopping all services..."
    
    # Stop Docker Compose services
    docker compose down --remove-orphans
    
    # Stop Supabase CLI if running
    if command -v npx > /dev/null 2>&1; then
        npx supabase stop || true
    fi
    
    log "All services stopped"
}

show_status() {
    echo "=== Docker Compose Services ==="
    docker compose ps
    
    echo ""
    echo "=== Supabase CLI Status ==="
    if curl -s http://localhost:54321/health > /dev/null 2>&1; then
        echo "✅ Supabase API: Running"
    else
        echo "❌ Supabase API: Not running"
    fi
    
    if curl -s http://localhost:54323 > /dev/null 2>&1; then
        echo "✅ Supabase Studio: Running"
    else
        echo "❌ Supabase Studio: Not running"
    fi
}

show_logs() {
    log "Showing logs from all services..."
    docker compose logs -f
}

show_urls() {
    echo ""
    echo "🚀 Development Environment Ready!"
    echo ""
    echo "📊 Supabase Studio:    http://localhost:54323"
    echo "🔗 Supabase API:       http://localhost:54321"
    echo "🌐 Your Web App:       http://localhost:3000"
    echo "⚡ Your API:           http://localhost:3001"
    echo "📧 Email Testing:      http://localhost:54326 (if using compose)"
    echo ""
    echo "🔑 Default Supabase Keys:"
    echo "   Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
    echo ""
    echo "💡 Use '$0 stop' to stop all services"
    echo "💡 Use '$0 status' to check service status"
    echo "💡 Use '$0 logs' to view logs"
}

# Main logic
case "${1:-cli}" in
    "cli")
        start_with_cli
        ;;
    "compose")
        start_with_compose
        ;;
    "apps-only")
        start_apps_only
        ;;
    "stop")
        stop_all
        ;;
    "status")
        show_status
        ;;
    "logs")
        show_logs
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
