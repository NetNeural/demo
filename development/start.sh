#!/bin/bash
# NetNeural Development Environment - Startup Script

set -e  # Exit on error

echo "🚀 Starting NetNeural Development Environment..."
echo ""

# Navigate to development directory
cd "$(dirname "$0")"

# Check if services are already running
echo "📋 Checking for existing services..."
RUNNING_PORTS=$(netstat -ano | grep -E ':(3000|54321)' | grep LISTENING || true)
if [ ! -z "$RUNNING_PORTS" ]; then
    echo "⚠️  Warning: Ports 3000 or 54321 are already in use!"
    echo "$RUNNING_PORTS"
    read -p "Stop existing services? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ./stop.sh
        sleep 2
    else
        echo "❌ Aborted. Please stop existing services first."
        exit 1
    fi
fi

# Step 1: Start Supabase
echo ""
echo "1️⃣  Starting Supabase..."
npx supabase start
if [ $? -ne 0 ]; then
    echo "❌ Failed to start Supabase"
    exit 1
fi
echo "✅ Supabase started"

# Step 2: Start Next.js in background
echo ""
echo "2️⃣  Starting Next.js Dev Server..."
nohup npm run dev > logs/nextjs.log 2>&1 &
NEXTJS_PID=$!
echo $NEXTJS_PID > .nextjs.pid
echo "✅ Next.js started (PID: $NEXTJS_PID)"

# Wait for Next.js to be ready
echo "⏳ Waiting for Next.js to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:3000 > /dev/null; then
        echo "✅ Next.js is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Next.js failed to start within 30 seconds"
        cat logs/nextjs.log
        exit 1
    fi
    sleep 1
done

# Step 3: Start Edge Functions in background
echo ""
echo "3️⃣  Starting Edge Functions..."
nohup npm run supabase:functions:serve > logs/edge-functions.log 2>&1 &
EDGE_PID=$!
echo $EDGE_PID > .edge-functions.pid
echo "✅ Edge Functions started (PID: $EDGE_PID)"

# Wait a bit for Edge Functions to initialize
sleep 3

echo ""
echo "✨ All services started successfully!"
echo ""
echo "📊 Service Status:"
echo "  • Supabase:       http://127.0.0.1:54321"
echo "  • Next.js:        http://localhost:3000 (PID: $NEXTJS_PID)"
echo "  • Edge Functions: http://127.0.0.1:54321/functions/v1/ (PID: $EDGE_PID)"
echo "  • Studio:         http://127.0.0.1:54323"
echo ""
echo "📝 Logs:"
echo "  • Next.js:        tail -f logs/nextjs.log"
echo "  • Edge Functions: tail -f logs/edge-functions.log"
echo ""
echo "🛑 To stop all services: ./stop.sh"
echo "📊 To check status:      ./status.sh"
