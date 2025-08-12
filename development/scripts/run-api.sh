#!/bin/bash

# Dedicated API Server Runner
# This script runs ONLY the API server and logs everything

PROJECT_ROOT="c:/Users/kaidr/OneDrive/Documents/Development/NetNeural/SoftwareMono/development"
LOG_DIR="$PROJECT_ROOT/logs"
SERVICE_NAME="api"

# Create log directory
mkdir -p "$LOG_DIR"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} Starting API Server..."
echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} Project Root: $PROJECT_ROOT"
echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} Logs: $LOG_DIR/api.log"
echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} PID: $$"

# Save PID
echo $$ > "$PROJECT_ROOT/pids/api.pid"

# Navigate to project root
cd "$PROJECT_ROOT"

# Function to cleanup on exit
cleanup() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} API Server shutting down..."
    rm -f "$PROJECT_ROOT/pids/api.pid"
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

# Start the API server with live logging
echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} API Server starting on http://localhost:3001"
npm run dev:api 2>&1 | tee "$LOG_DIR/api.log"
