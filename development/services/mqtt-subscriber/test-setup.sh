#!/bin/bash
# Test MQTT Subscriber Service setup

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🧪 Testing MQTT Subscriber Service Setup"
echo "========================================"
echo ""

# Check Node.js
echo "1️⃣  Checking Node.js..."
if command -v node > /dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    echo "   ✅ Node.js installed: $NODE_VERSION"
else
    echo "   ❌ Node.js not found (required for local development)"
fi
echo ""

# Check Docker
echo "2️⃣  Checking Docker..."
if command -v docker > /dev/null 2>&1; then
    DOCKER_VERSION=$(docker --version)
    echo "   ✅ Docker installed: $DOCKER_VERSION"
    
    if docker info > /dev/null 2>&1; then
        echo "   ✅ Docker daemon is running"
    else
        echo "   ❌ Docker daemon not running"
    fi
else
    echo "   ❌ Docker not found (required for production deployment)"
fi
echo ""

# Check docker-compose
echo "3️⃣  Checking Docker Compose..."
if command -v docker-compose > /dev/null 2>&1; then
    COMPOSE_VERSION=$(docker-compose --version)
    echo "   ✅ Docker Compose installed: $COMPOSE_VERSION"
else
    echo "   ❌ Docker Compose not found"
fi
echo ""

# Check .env file
echo "4️⃣  Checking configuration..."
if [ -f .env ]; then
    echo "   ✅ .env file exists"
    
    # Check required variables
    source .env
    
    if [ -n "$SUPABASE_URL" ]; then
        echo "   ✅ SUPABASE_URL is set"
    else
        echo "   ❌ SUPABASE_URL is not set"
    fi
    
    if [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
        echo "   ✅ SUPABASE_SERVICE_ROLE_KEY is set"
    else
        echo "   ❌ SUPABASE_SERVICE_ROLE_KEY is not set"
    fi
else
    echo "   ❌ .env file not found"
    echo "      Run: cp .env.example .env"
fi
echo ""

# Check dependencies
echo "5️⃣  Checking dependencies..."
if [ -f package.json ]; then
    if [ -d node_modules ]; then
        echo "   ✅ Dependencies installed (node_modules exists)"
    else
        echo "   ⚠️  Dependencies not installed"
        echo "      Run: npm install"
    fi
else
    echo "   ❌ package.json not found"
fi
echo ""

# Summary
echo "📋 Summary"
echo "==========="
echo ""

if [ -f .env ] && [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "✅ Configuration: READY"
else
    echo "❌ Configuration: NOT READY"
    echo "   Action: Create and configure .env file"
fi
echo ""

if [ -d node_modules ]; then
    echo "✅ Dependencies: INSTALLED"
    echo "   You can run: npm run dev"
else
    echo "⚠️  Dependencies: NOT INSTALLED"
    echo "   Action: Run 'npm install'"
fi
echo ""

if command -v docker > /dev/null 2>&1 && docker info > /dev/null 2>&1; then
    echo "✅ Docker: READY"
    echo "   You can run: ./start.sh"
else
    echo "⚠️  Docker: NOT READY"
    echo "   Action: Install and start Docker"
fi
echo ""

echo "📖 Next Steps:"
echo "=============="
echo ""
echo "For local development:"
echo "  1. npm install"
echo "  2. npm run dev"
echo ""
echo "For production deployment:"
echo "  1. ./start.sh"
echo "  2. ./status.sh"
echo "  3. ./logs.sh"
echo ""
