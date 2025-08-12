#!/bin/bash

# NetNeural IoT Platform Service Health Checker
# Quick health check before making any changes to the system

PROJECT_ROOT="c:/Users/kaidr/OneDrive/Documents/Development/NetNeural/SoftwareMono/development"
PID_DIR="$PROJECT_ROOT/pids"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if service is running by PID
check_service_pid() {
    local service="$1"
    local pid_file="$PID_DIR/${service}.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ $service${NC} (PID: $pid)"
            return 0
        else
            echo -e "${RED}❌ $service${NC} (PID file exists but process dead)"
            rm -f "$pid_file"
            return 1
        fi
    else
        echo -e "${RED}❌ $service${NC} (No PID file)"
        return 1
    fi
}

# Check if port is in use
check_port() {
    local port="$1"
    local service="$2"
    
    if netstat -an | grep ":$port " | grep LISTENING > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Port $port${NC} ($service)"
        return 0
    else
        echo -e "${RED}❌ Port $port${NC} ($service not listening)"
        return 1
    fi
}

# Quick HTTP health check
check_http() {
    local url="$1"
    local service="$2"
    
    if curl -s --max-time 2 "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $service HTTP${NC} ($url)"
        return 0
    else
        echo -e "${RED}❌ $service HTTP${NC} ($url not responding)"
        return 1
    fi
}

# Main health check
echo -e "${BLUE}=== NetNeural IoT Platform Health Check ===${NC}"
echo -e "${BLUE}$(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo ""

echo -e "${BLUE}🔍 Process Status:${NC}"
check_service_pid "api"
check_service_pid "web"

echo ""
echo -e "${BLUE}🔌 Port Status:${NC}"
check_port "3000" "Web Server"
check_port "3001" "API Server"
check_port "54321" "Supabase"

echo ""
echo -e "${BLUE}🌐 HTTP Health:${NC}"
check_http "http://localhost:3000" "Web App"
check_http "http://localhost:3001/health" "API Server"
check_http "http://127.0.0.1:54321" "Supabase"

echo ""
echo -e "${BLUE}📊 Supabase Status:${NC}"
cd "$PROJECT_ROOT"
if npx supabase status > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Supabase${NC} (Running)"
else
    echo -e "${RED}❌ Supabase${NC} (Stopped)"
fi

echo ""
echo -e "${BLUE}=== Health Check Complete ===${NC}"

# Return overall health status
api_running=0
web_running=0
supabase_running=0

check_service_pid "api" > /dev/null && api_running=1
check_service_pid "web" > /dev/null && web_running=1
npx supabase status > /dev/null 2>&1 && supabase_running=1

if [ $api_running -eq 1 ] && [ $web_running -eq 1 ] && [ $supabase_running -eq 1 ]; then
    echo -e "${GREEN}🎉 All services healthy!${NC}"
    exit 0
elif [ $api_running -eq 1 ] || [ $web_running -eq 1 ]; then
    echo -e "${YELLOW}⚠️  Some services running${NC}"
    exit 1
else
    echo -e "${RED}🚨 No services running${NC}"
    exit 2
fi
