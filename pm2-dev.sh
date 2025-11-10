#!/bin/bash
# NetNeural PM2 Development Manager

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Navigate to project root
cd "$(dirname "$0")"

show_help() {
    echo -e "${BLUE}NetNeural PM2 Development Manager${NC}"
    echo ""
    echo "Usage: ./pm2-dev.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start       - Start all services (Supabase + PM2 apps)"
    echo "  stop        - Stop all services"
    echo "  restart     - Restart all services"
    echo "  status      - Show status of all services"
    echo "  logs        - Show live logs from all PM2 apps"
    echo "  logs-next   - Show Next.js logs only"
    echo "  logs-edge   - Show Edge Functions logs only"
    echo "  monit       - Open PM2 monitoring dashboard"
    echo "  reset       - Stop all, clean logs, restart fresh"
    echo ""
}

check_supabase() {
    if curl -s http://127.0.0.1:54321/health > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

start_services() {
    echo -e "${BLUE}🚀 Starting NetNeural Development Environment${NC}"
    echo ""
    
    # Check if Supabase is running
    if check_supabase; then
        echo -e "${GREEN}✅ Supabase already running${NC}"
    else
        echo -e "${YELLOW}📦 Starting Supabase...${NC}"
        cd development
        npx supabase start
        cd ..
        echo -e "${GREEN}✅ Supabase started${NC}"
    fi
    
    echo ""
    echo -e "${YELLOW}⚡ Starting PM2 applications...${NC}"
    pm2 start ecosystem.config.js
    
    echo ""
    echo -e "${GREEN}✨ All services started!${NC}"
    echo ""
    show_status
}

stop_services() {
    echo -e "${YELLOW}🛑 Stopping all services...${NC}"
    echo ""
    
    # Stop PM2 apps
    pm2 stop ecosystem.config.js > /dev/null 2>&1 || true
    pm2 delete ecosystem.config.js > /dev/null 2>&1 || true
    
    # Stop Supabase
    cd development
    npx supabase stop --no-backup
    cd ..
    
    echo -e "${GREEN}✅ All services stopped${NC}"
}

restart_services() {
    echo -e "${YELLOW}🔄 Restarting all services...${NC}"
    echo ""
    
    pm2 restart ecosystem.config.js
    
    echo -e "${GREEN}✅ Services restarted${NC}"
    echo ""
    show_status
}

show_status() {
    echo -e "${BLUE}📊 Service Status${NC}"
    echo ""
    
    # Supabase status
    echo -e "${BLUE}🐘 Supabase:${NC}"
    if check_supabase; then
        echo -e "  ${GREEN}✅ Running${NC} - http://127.0.0.1:54321"
        CONTAINERS=$(docker ps --filter "name=supabase" --format "{{.Names}}" | wc -l)
        echo -e "  📦 Containers: $CONTAINERS"
    else
        echo -e "  ${RED}❌ Not Running${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}⚡ PM2 Applications:${NC}"
    pm2 list
    
    echo ""
    echo -e "${BLUE}🌐 Service URLs:${NC}"
    echo "  • Supabase API:   http://127.0.0.1:54321"
    echo "  • Studio:         http://127.0.0.1:54323"
    echo "  • Next.js:        http://localhost:3000"
    echo "  • Edge Functions: http://127.0.0.1:54321/functions/v1/"
}

show_logs() {
    echo -e "${BLUE}📝 Showing logs (Ctrl+C to exit)${NC}"
    pm2 logs
}

show_nextjs_logs() {
    echo -e "${BLUE}📝 Next.js Logs (Ctrl+C to exit)${NC}"
    pm2 logs netneural-nextjs
}

show_edge_logs() {
    echo -e "${BLUE}📝 Edge Functions Logs (Ctrl+C to exit)${NC}"
    pm2 logs netneural-edge-functions
}

show_monit() {
    echo -e "${BLUE}📊 Opening PM2 monitoring dashboard (Ctrl+C to exit)${NC}"
    pm2 monit
}

reset_environment() {
    echo -e "${RED}🔥 Resetting environment (stopping all, cleaning logs)${NC}"
    echo ""
    
    # Stop everything
    stop_services
    
    # Clean PM2 logs
    pm2 flush
    
    # Clean log files
    rm -f development/logs/*.log
    
    echo ""
    echo -e "${GREEN}✅ Environment reset${NC}"
    echo ""
    read -p "Start services now? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        start_services
    fi
}

# Main command handler
case "${1}" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    logs-next)
        show_nextjs_logs
        ;;
    logs-edge)
        show_edge_logs
        ;;
    monit)
        show_monit
        ;;
    reset)
        reset_environment
        ;;
    *)
        show_help
        ;;
esac
