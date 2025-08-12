#!/bin/bash

# NetNeural IoT Platform Auto-Startup Daemon
# This script automatically starts and monitors all required services
# Services will auto-restart if they crash and auto-start on system boot

PROJECT_ROOT="c:/Users/kaidr/OneDrive/Documents/Development/NetNeural/SoftwareMono/development"
LOG_DIR="$PROJECT_ROOT/logs"
PID_DIR="$PROJECT_ROOT/pids"
DAEMON_PID_FILE="$PID_DIR/auto-startup-daemon.pid"

# Create directories
mkdir -p "$LOG_DIR" "$PID_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_DIR/auto-startup.log"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_DIR/auto-startup.log"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_DIR/auto-startup.log"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_DIR/auto-startup.log"
}

# Check if service is running
is_service_running() {
    local service="$1"
    local pid_file="$PID_DIR/${service}.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        else
            rm -f "$pid_file"
            return 1
        fi
    fi
    return 1
}

# Check if port is in use
is_port_in_use() {
    local port="$1"
    netstat -an | grep ":$port " | grep LISTENING > /dev/null 2>&1
    return $?
}

# Auto-start Supabase if not running
ensure_supabase() {
    if ! npx supabase status > /dev/null 2>&1; then
        log "Auto-starting Supabase..."
        cd "$PROJECT_ROOT"
        npx supabase start > "$LOG_DIR/supabase-autostart.log" 2>&1 &
        sleep 5
        if npx supabase status > /dev/null 2>&1; then
            log_success "✅ Supabase auto-started successfully"
        else
            log_error "❌ Failed to auto-start Supabase"
        fi
    fi
}

# Auto-start API server if not running
ensure_api() {
    if ! is_service_running "api" && ! is_port_in_use "3001"; then
        log "Auto-starting API server..."
        cd "$PROJECT_ROOT"
        
        # Start API in background
        nohup ./scripts/run-api.sh > "$LOG_DIR/api-autostart.log" 2>&1 &
        sleep 3
        
        if is_service_running "api" || is_port_in_use "3001"; then
            log_success "✅ API server auto-started successfully"
        else
            log_error "❌ Failed to auto-start API server"
        fi
    fi
}

# Auto-start Web server if not running
ensure_web() {
    if ! is_service_running "web" && ! is_port_in_use "3000"; then
        log "Auto-starting Web server..."
        cd "$PROJECT_ROOT"
        
        # Start Web in background
        nohup ./scripts/run-web.sh > "$LOG_DIR/web-autostart.log" 2>&1 &
        sleep 3
        
        if is_service_running "web" || is_port_in_use "3000"; then
            log_success "✅ Web server auto-started successfully"
        else
            log_error "❌ Failed to auto-start Web server"
        fi
    fi
}

# Main monitoring loop
monitor_services() {
    log "Starting NetNeural IoT Platform Auto-Startup Daemon"
    log "Monitoring and auto-restarting services every 30 seconds"
    
    while true; do
        # Check and ensure all services are running
        ensure_supabase
        ensure_api
        ensure_web
        
        # Wait before next check
        sleep 30
    done
}

# Daemon control functions
start_daemon() {
    if [ -f "$DAEMON_PID_FILE" ] && ps -p "$(cat $DAEMON_PID_FILE)" > /dev/null 2>&1; then
        log_warning "Auto-startup daemon is already running (PID: $(cat $DAEMON_PID_FILE))"
        return 0
    fi
    
    log "Starting auto-startup daemon..."
    
    # Start daemon in background
    monitor_services &
    local daemon_pid=$!
    echo $daemon_pid > "$DAEMON_PID_FILE"
    
    log_success "Auto-startup daemon started with PID: $daemon_pid"
    log_success "Services will auto-start and auto-restart as needed"
    
    # Keep daemon running
    wait $daemon_pid
}

stop_daemon() {
    if [ -f "$DAEMON_PID_FILE" ]; then
        local pid=$(cat "$DAEMON_PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            log "Stopping auto-startup daemon (PID: $pid)..."
            kill $pid
            rm -f "$DAEMON_PID_FILE"
            log_success "Auto-startup daemon stopped"
        else
            log_warning "Daemon not running, cleaning up PID file"
            rm -f "$DAEMON_PID_FILE"
        fi
    else
        log_warning "Auto-startup daemon is not running"
    fi
}

daemon_status() {
    if [ -f "$DAEMON_PID_FILE" ] && ps -p "$(cat $DAEMON_PID_FILE)" > /dev/null 2>&1; then
        log_success "✅ Auto-startup daemon is running (PID: $(cat $DAEMON_PID_FILE))"
    else
        log_error "❌ Auto-startup daemon is not running"
    fi
}

# One-time startup (no daemon)
startup_once() {
    log "Performing one-time startup of all services..."
    ensure_supabase
    sleep 2
    ensure_api  
    sleep 2
    ensure_web
    log_success "One-time startup complete"
}

# Cleanup function
cleanup() {
    log "Shutting down auto-startup daemon..."
    stop_daemon
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

# Main script logic
case "$1" in
    "start")
        start_daemon
        ;;
    "stop")
        stop_daemon
        ;;
    "restart")
        stop_daemon
        sleep 2
        start_daemon
        ;;
    "status")
        daemon_status
        ;;
    "once"|"startup")
        startup_once
        ;;
    *)
        echo "NetNeural IoT Platform Auto-Startup System"
        echo ""
        echo "Usage: $0 {start|stop|restart|status|once}"
        echo ""
        echo "Commands:"
        echo "  start    - Start auto-startup daemon (monitors and restarts services)"
        echo "  stop     - Stop auto-startup daemon"
        echo "  restart  - Restart auto-startup daemon"
        echo "  status   - Check daemon status"
        echo "  once     - One-time startup of all services (no monitoring)"
        echo ""
        echo "The daemon will automatically:"
        echo "  - Start Supabase, API, and Web servers if not running"
        echo "  - Restart crashed services automatically"
        echo "  - Monitor every 30 seconds"
        echo "  - Log all activities to logs/auto-startup.log"
        ;;
esac
