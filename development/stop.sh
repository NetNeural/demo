#!/bin/bash
# NetNeural Development Environment - Shutdown Script

set -e

echo "🛑 Stopping NetNeural Development Environment..."
echo ""

# Navigate to development directory
cd "$(dirname "$0")"

# Stop Next.js
if [ -f .nextjs.pid ]; then
    NEXTJS_PID=$(cat .nextjs.pid)
    echo "Stopping Next.js (PID: $NEXTJS_PID)..."
    kill $NEXTJS_PID 2>/dev/null || echo "  (Process already stopped)"
    rm .nextjs.pid
fi

# Stop Edge Functions
if [ -f .edge-functions.pid ]; then
    EDGE_PID=$(cat .edge-functions.pid)
    echo "Stopping Edge Functions (PID: $EDGE_PID)..."
    kill $EDGE_PID 2>/dev/null || echo "  (Process already stopped)"
    rm .edge-functions.pid
fi

# Stop Supabase
echo "Stopping Supabase..."
npx supabase stop --no-backup

echo ""
echo "✅ All services stopped"
