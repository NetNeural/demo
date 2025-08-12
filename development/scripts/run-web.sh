#!/bin/bash

# Dedicated Web Server Runner
# This script runs ONLY the web server and logs everything

PROJECT_ROOT="c:/Users/kaidr/OneDrive/Documents/Development/NetNeural/SoftwareMono/development"
LOG_DIR="$PROJECT_ROOT/logs"
SERVICE_NAME="web"

# Create log directory
mkdir -p "$LOG_DIR"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} Starting Web Server..."
echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} Project Root: $PROJECT_ROOT"
echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} Logs: $LOG_DIR/web.log"
echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} PID: $$"

# Save PID
echo $$ > "$PROJECT_ROOT/pids/web.pid"

# Navigate to project root
cd "$PROJECT_ROOT"

# Function to cleanup on exit
cleanup() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} Web Server shutting down..."
    rm -f "$PROJECT_ROOT/pids/web.pid"
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

# Start the web server with live logging
echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} Web Server starting on http://localhost:3000"
npm run dev:web 2>&1 | tee "$LOG_DIR/web.log"
