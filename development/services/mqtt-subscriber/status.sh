#!/bin/bash
# Check MQTT Subscriber Service status

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔍 NetNeural MQTT Subscriber Service Status"
echo "==========================================="
echo ""

# Check if container exists
if docker-compose ps | grep -q mqtt-subscriber; then
    echo "📊 Container Status:"
    docker-compose ps mqtt-subscriber
    echo ""
    
    # Check if running
    if docker-compose ps | grep mqtt-subscriber | grep -q "Up"; then
        echo "✅ Service is RUNNING"
        echo ""
        
        # Show recent logs
        echo "📝 Recent logs (last 20 lines):"
        echo "-----------------------------------"
        docker-compose logs --tail=20 mqtt-subscriber
    else
        echo "❌ Service is STOPPED"
        echo ""
        echo "💡 Start with: ./start.sh"
    fi
else
    echo "⚠️  Container not found"
    echo ""
    echo "💡 Start with: ./start.sh"
fi
