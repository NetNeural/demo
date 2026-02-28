#!/bin/bash
# Start MQTT Subscriber Service with Docker Compose

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting NetNeural MQTT Subscriber Service..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "📝 Please create .env from .env.example:"
    echo "   cp .env.example .env"
    echo "   nano .env  # Edit with your credentials"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running!"
    echo "   Please start Docker Desktop or Docker daemon"
    exit 1
fi

# Build and start service
echo "🔨 Building Docker image..."
docker-compose build

echo "▶️  Starting service..."
docker-compose up -d

echo ""
echo "✅ Service started successfully!"
echo ""
echo "📊 View logs:"
echo "   docker-compose logs -f mqtt-subscriber"
echo ""
echo "🔍 Check status:"
echo "   docker-compose ps"
echo ""
echo "🛑 Stop service:"
echo "   docker-compose down"
echo ""
echo "🔄 Restart service:"
echo "   docker-compose restart"
