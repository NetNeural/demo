#!/bin/bash

# Log Viewer for NetNeural IoT Platform
# Watch logs in real-time for debugging

PROJECT_ROOT="c:/Users/kaidr/OneDrive/Documents/Development/NetNeural/SoftwareMono/development"
LOG_DIR="$PROJECT_ROOT/logs"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

show_help() {
    echo "NetNeural IoT Platform Log Viewer"
    echo ""
    echo "Usage: $0 [service]"
    echo ""
    echo "Services:"
    echo "  api     - Watch API server logs"
    echo "  web     - Watch Web server logs"
    echo "  all     - Watch all logs (split view)"
    echo ""
    echo "Examples:"
    echo "  $0 api     - Tail API logs"
    echo "  $0 web     - Tail Web logs"
    echo "  $0 all     - Watch all logs"
}

tail_service_logs() {
    local service="$1"
    local log_file="$LOG_DIR/${service}.log"
    
    if [ -f "$log_file" ]; then
        echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} Watching $service logs (Ctrl+C to exit)..."
        echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} Log file: $log_file"
        echo ""
        tail -f "$log_file"
    else
        echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} Log file not found: $log_file"
        echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} Start the $service service first"
    fi
}

watch_all_logs() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} Watching all service logs..."
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} API logs will be prefixed with [API]"
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} Web logs will be prefixed with [WEB]"
    echo ""
    
    # Use multitail if available, otherwise fallback to simple tail
    if command -v multitail >/dev/null 2>&1; then
        multitail -l "tail -f $LOG_DIR/api.log" -l "tail -f $LOG_DIR/web.log"
    else
        # Simple fallback - tail both files with prefixes
        (tail -f "$LOG_DIR/api.log" 2>/dev/null | sed 's/^/[API] /' &)
        (tail -f "$LOG_DIR/web.log" 2>/dev/null | sed 's/^/[WEB] /' &)
        wait
    fi
}

case "$1" in
    "api")
        tail_service_logs "api"
        ;;
    "web")
        tail_service_logs "web"
        ;;
    "all")
        watch_all_logs
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    "")
        show_help
        ;;
    *)
        echo -e "${RED}Unknown service: $1${NC}"
        echo ""
        show_help
        ;;
esac
