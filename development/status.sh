#!/bin/bash
# NetNeural Development Environment - Status Check Script

echo "📊 NetNeural Development Environment Status"
echo ""

# Navigate to development directory
cd "$(dirname "$0")"

# Check Supabase
echo "🐘 Supabase:"
SUPABASE_STATUS=$(curl -s http://127.0.0.1:54321/health 2>/dev/null || echo "DOWN")
if [ "$SUPABASE_STATUS" != "DOWN" ]; then
    echo "  ✅ Running - http://127.0.0.1:54321"
    CONTAINERS=$(docker ps --filter "name=supabase" --format "{{.Names}}" | wc -l)
    echo "  📦 Containers: $CONTAINERS"
else
    echo "  ❌ Not Running"
fi

echo ""
echo "⚛️  Next.js:"
if [ -f .nextjs.pid ]; then
    NEXTJS_PID=$(cat .nextjs.pid)
    if ps -p $NEXTJS_PID > /dev/null 2>&1; then
        echo "  ✅ Running - http://localhost:3000 (PID: $NEXTJS_PID)"
        echo "  📝 Log: logs/nextjs.log"
        NEXTJS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
        if [ "$NEXTJS_STATUS" = "200" ]; then
            echo "  🌐 HTTP Status: $NEXTJS_STATUS OK"
        else
            echo "  ⚠️  HTTP Status: $NEXTJS_STATUS"
        fi
    else
        echo "  ❌ PID file exists but process not running"
        rm .nextjs.pid
    fi
else
    echo "  ❌ Not Running"
fi

echo ""
echo "⚡ Edge Functions:"
if [ -f .edge-functions.pid ]; then
    EDGE_PID=$(cat .edge-functions.pid)
    if ps -p $EDGE_PID > /dev/null 2>&1; then
        echo "  ✅ Running (PID: $EDGE_PID)"
        echo "  📝 Log: logs/edge-functions.log"
        echo "  🔗 URL: http://127.0.0.1:54321/functions/v1/"
    else
        echo "  ❌ PID file exists but process not running"
        rm .edge-functions.pid
    fi
else
    echo "  ❌ Not Running"
fi

echo ""
echo "📝 Recent Logs:"
echo ""
echo "--- Next.js (last 5 lines) ---"
if [ -f logs/nextjs.log ]; then
    tail -n 5 logs/nextjs.log
else
    echo "  (no log file)"
fi

echo ""
echo "--- Edge Functions (last 5 lines) ---"
if [ -f logs/edge-functions.log ]; then
    tail -n 5 logs/edge-functions.log
else
    echo "  (no log file)"
fi
