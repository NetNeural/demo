#!/bin/bash

# NetNeural IoT Platform - Simple Startup Script
# This is the main entry point for starting the platform

# Change to the development directory
cd "$(dirname "$0")" || exit 1

echo "🚀 Starting NetNeural IoT Platform..."
echo "======================================="

# Check if services are already running
if ./scripts/health-check.sh >/dev/null 2>&1; then
    echo "✅ Services are already running! No action needed."
    echo ""
    echo "📱 Web Dashboard: http://localhost:3000"
    echo "🔗 API Server: http://localhost:3001"
    echo "🛢️ Supabase: http://127.0.0.1:54321"
    echo ""
    echo "Run './scripts/process-manager.sh stop all' to stop services"
    exit 0
fi

# Start auto-startup once to ensure everything is running
echo "🔄 Starting services..."
./scripts/auto-startup.sh once

# Give services a moment to start
sleep 3

# Show final status
echo ""
echo "✅ Platform startup complete!"
echo ""
echo "📱 Web Dashboard: http://localhost:3000"
echo "🔗 API Server: http://localhost:3001"
echo "🛢️ Supabase: http://127.0.0.1:54321"
echo ""
echo "💡 Tips:"
echo "  • Run './scripts/health-check.sh' to check service status"
echo "  • Run './scripts/process-manager.sh stop all' to stop all services"
echo "  • Services will auto-restart if they crash"
