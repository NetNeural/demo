#!/bin/bash
# View MQTT Subscriber Service logs

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "📊 Viewing MQTT Subscriber logs (Ctrl+C to exit)..."
echo ""

docker-compose logs -f mqtt-subscriber
