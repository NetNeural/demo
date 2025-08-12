#!/bin/bash

# NetNeural IoT Platform Process Manager
# This script manages all services with proper process tracking and logging

PROJECT_ROOT="c:/Users/kaidr/OneDrive/Documents/Development/NetNeural/SoftwareMono/development"
LOG_DIR="$PROJECT_ROOT/logs"
PID_DIR="$PROJECT_ROOT/pids"

# Create directories if they don't exist
mkdir -p "$LOG_DIR"
mkdir -p "$PID_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

# Function to check if a process is running
is_running() {
    local pid_file="$1"
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

# Function to start Supabase
start_supabase() {
    print_status "Starting Supabase..."
    cd "$PROJECT_ROOT"
    
    if npx supabase status > /dev/null 2>&1; then
        print_success "Supabase is already running"
        return 0
    fi
    
    npx supabase start > "$LOG_DIR/supabase.log" 2>&1 &
    local pid=$!
    echo $pid > "$PID_DIR/supabase.pid"
    print_success "Supabase started with PID: $pid"
}

# Function to start API server
start_api() {
    local pid_file="$PID_DIR/api.pid"
    
    if is_running "$pid_file"; then
        print_warning "API server is already running (PID: $(cat $pid_file))"
        return 0
    fi
    
    print_status "Starting API server..."
    cd "$PROJECT_ROOT"
    
    # Start API server in background with logging
    nohup npm run dev:api > "$LOG_DIR/api.log" 2>&1 &
    local pid=$!
    echo $pid > "$pid_file"
    
    # Wait a moment and check if it started successfully
    sleep 3
    if is_running "$pid_file"; then
        print_success "API server started with PID: $pid"
        print_status "API server logs: $LOG_DIR/api.log"
    else
        print_error "Failed to start API server"
        return 1
    fi
}

# Function to start Web server
start_web() {
    local pid_file="$PID_DIR/web.pid"
    
    if is_running "$pid_file"; then
        print_warning "Web server is already running (PID: $(cat $pid_file))"
        return 0
    fi
    
    print_status "Starting Web server..."
    cd "$PROJECT_ROOT"
    
    # Start web server in background with logging
    nohup npm run dev:web > "$LOG_DIR/web.log" 2>&1 &
    local pid=$!
    echo $pid > "$pid_file"
    
    # Wait a moment and check if it started successfully
    sleep 3
    if is_running "$pid_file"; then
        print_success "Web server started with PID: $pid"
        print_status "Web server logs: $LOG_DIR/web.log"
    else
        print_error "Failed to start Web server"
        return 1
    fi
}

# Function to stop a service
stop_service() {
    local service_name="$1"
    local pid_file="$PID_DIR/${service_name}.pid"
    
    if is_running "$pid_file"; then
        local pid=$(cat "$pid_file")
        print_status "Stopping $service_name (PID: $pid)..."
        kill $pid
        rm -f "$pid_file"
        print_success "$service_name stopped"
    else
        print_warning "$service_name is not running"
    fi
}

# Function to show status of all services
show_status() {
    print_status "=== NetNeural IoT Platform Status ==="
    
    # Check Supabase
    if npx supabase status > /dev/null 2>&1; then
        print_success "✅ Supabase: Running"
    else
        print_error "❌ Supabase: Stopped"
    fi
    
    # Check API server
    if is_running "$PID_DIR/api.pid"; then
        local pid=$(cat "$PID_DIR/api.pid")
        print_success "✅ API Server: Running (PID: $pid)"
    else
        print_error "❌ API Server: Stopped"
    fi
    
    # Check Web server
    if is_running "$PID_DIR/web.pid"; then
        local pid=$(cat "$PID_DIR/web.pid")
        print_success "✅ Web Server: Running (PID: $pid)"
    else
        print_error "❌ Web Server: Stopped"
    fi
    
    echo ""
    print_status "=== Service URLs ==="
    echo "🌐 Web App: http://localhost:3000"
    echo "🔧 API: http://localhost:3001"
    echo "🗄️ Supabase: http://127.0.0.1:54321"
    echo "📊 Supabase Studio: http://127.0.0.1:54323"
}

# Function to tail logs
tail_logs() {
    local service="$1"
    local log_file="$LOG_DIR/${service}.log"
    
    if [ -f "$log_file" ]; then
        print_status "Tailing logs for $service (Ctrl+C to exit)..."
        tail -f "$log_file"
    else
        print_error "Log file not found: $log_file"
    fi
}

# Function to start all services
start_all() {
    print_status "Starting all NetNeural IoT Platform services..."
    start_supabase
    sleep 2
    start_api
    sleep 2
    start_web
    echo ""
    show_status
}

# Function to stop all services
stop_all() {
    print_status "Stopping all NetNeural IoT Platform services..."
    stop_service "web"
    stop_service "api"
    npx supabase stop > /dev/null 2>&1
    print_success "All services stopped"
}

# Function to restart all services
restart_all() {
    print_status "Restarting all NetNeural IoT Platform services..."
    stop_all
    sleep 2
    start_all
}

# Main script logic
case "$1" in
    "start")
        case "$2" in
            "api") start_api ;;
            "web") start_web ;;
            "supabase") start_supabase ;;
            "all"|"") start_all ;;
            *) print_error "Unknown service: $2" ;;
        esac
        ;;
    "stop")
        case "$2" in
            "api") stop_service "api" ;;
            "web") stop_service "web" ;;
            "supabase") npx supabase stop ;;
            "all"|"") stop_all ;;
            *) print_error "Unknown service: $2" ;;
        esac
        ;;
    "restart")
        case "$2" in
            "api") stop_service "api"; sleep 1; start_api ;;
            "web") stop_service "web"; sleep 1; start_web ;;
            "all"|"") restart_all ;;
            *) print_error "Unknown service: $2" ;;
        esac
        ;;
    "status")
        show_status
        ;;
    "logs")
        case "$2" in
            "api"|"web") tail_logs "$2" ;;
            *) print_error "Specify service: api, web" ;;
        esac
        ;;
    *)
        echo "NetNeural IoT Platform Process Manager"
        echo ""
        echo "Usage: $0 {start|stop|restart|status|logs} [service]"
        echo ""
        echo "Commands:"
        echo "  start [service]    - Start service(s) [api|web|supabase|all]"
        echo "  stop [service]     - Stop service(s) [api|web|supabase|all]"
        echo "  restart [service]  - Restart service(s) [api|web|all]"
        echo "  status             - Show status of all services"
        echo "  logs [service]     - Tail logs for service [api|web]"
        echo ""
        echo "Examples:"
        echo "  $0 start all       - Start all services"
        echo "  $0 start api       - Start only API server"
        echo "  $0 logs api        - Watch API server logs"
        echo "  $0 status          - Check service status"
        ;;
esac
