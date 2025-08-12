#!/bin/bash

# NetNeural IoT Platform - Hot Reload Development Mode
# This script starts all services with optimal hot reload capabilities

# Change to the development directory
cd "$(dirname "$0")" || exit 1

echo "🔥 Starting NetNeural IoT Platform in Hot Reload Development Mode..."
echo "================================================================="

# Function to check if a service is running
check_service() {
    local port=$1
    local service_name=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "✅ $service_name already running on port $port"
        return 0
    else
        echo "❌ $service_name not running on port $port"
        return 1
    fi
}

# Check current status
echo ""
echo "📊 Current Service Status:"
check_service 54321 "Supabase" && SUPABASE_RUNNING=true || SUPABASE_RUNNING=false
check_service 3001 "API Server" && API_RUNNING=true || API_RUNNING=false  
check_service 3000 "Web Server" && WEB_RUNNING=true || WEB_RUNNING=false

echo ""
echo "🔧 Hot Reload Configuration:"
echo "  • Next.js: Built-in Fast Refresh ⚡"
echo "  • API Server: tsx --watch for auto-restart 🔄"
echo "  • Packages: TypeScript --watch mode 👀"
echo "  • Turbo: Parallel execution with dependency watching 🚀"

# Start Supabase if not running
if [ "$SUPABASE_RUNNING" = false ]; then
    echo ""
    echo "🛢️ Starting Supabase..."
    npx supabase start
else
    echo ""
    echo "🛢️ Supabase already running - no restart needed"
fi

# Check if services need starting
if [ "$API_RUNNING" = false ] || [ "$WEB_RUNNING" = false ]; then
    echo ""
    echo "🚀 Starting services with hot reload..."
    echo "💡 Changes to components, API routes, and packages will auto-reload!"
    echo ""
    
    # Start all services with hot reload using turbo
    npm run dev:hot
else
    echo ""
    echo "✅ All services already running with hot reload enabled!"
    echo ""
    echo "🔄 Development servers are active:"
    echo "  📱 Web Dashboard: http://localhost:3000 (Next.js Fast Refresh)"
    echo "  🔗 API Server: http://localhost:3001 (tsx watch mode)"  
    echo "  🛢️ Supabase: http://127.0.0.1:54321"
    echo ""
    echo "💡 Hot Reload Features:"
    echo "  • React components auto-reload on save"
    echo "  • API routes restart automatically on changes"
    echo "  • Shared packages rebuild on modifications"
    echo "  • TypeScript compilation in watch mode"
    echo ""
    echo "🎯 No restart needed - just start coding!"
fi

echo ""
echo "🔧 Development Tips:"
echo "  • Edit components in apps/web/src/components/ - auto-reload ⚡"
echo "  • Modify API routes in apps/api/src/ - auto-restart 🔄"
echo "  • Update packages in packages/* - auto-rebuild 🏗️"
echo "  • Environment changes require restart only if needed"
echo ""
echo "📝 To stop all services: ./scripts/process-manager.sh stop all"
