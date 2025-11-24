#!/bin/bash
# Quick start script for development environment
# Usage: ./quick-start.sh

set -e

echo "🚀 NetNeural Quick Start"
echo ""

# Check if we're in the development directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this from the development/ directory"
    echo "   cd development && ./quick-start.sh"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running"
    echo "   Please start Docker and try again"
    exit 1
fi

# Check if Supabase is already running
if npx supabase status > /dev/null 2>&1; then
    echo "✅ Supabase is already running"
else
    echo "🐳 Starting Supabase (this takes 30-60 seconds)..."
    npx supabase start
    
    # Wait for Supabase to be healthy
    echo "⏳ Waiting for Supabase to be ready..."
    for i in {1..30}; do
        if npx supabase status > /dev/null 2>&1; then
            echo "✅ Supabase is ready!"
            break
        fi
        sleep 2
        echo -n "."
    done
    echo ""
fi

# Update .env.local with actual keys
echo "🔑 Updating environment variables..."
SUPABASE_STATUS=$(npx supabase status 2>&1)
ANON_KEY=$(echo "$SUPABASE_STATUS" | grep "Publishable key:" | awk '{print $3}')
SERVICE_KEY=$(echo "$SUPABASE_STATUS" | grep "Secret key:" | awk '{print $3}')

if [ "$CODESPACES" = "true" ]; then
    # Codespaces: browser needs public URL, server uses localhost
    CODESPACE_SUPABASE_URL="https://${CODESPACE_NAME}-54321.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
    sed -i "s|NEXT_PUBLIC_SUPABASE_URL=.*|NEXT_PUBLIC_SUPABASE_URL=$CODESPACE_SUPABASE_URL|g" .env.local
    sed -i "s|NEXT_PUBLIC_SUPABASE_ANON_KEY=.*|NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY|g" .env.local
    sed -i "s|SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY|g" .env.local
    echo "✅ Environment updated for Codespaces"
else
    # Local development: use localhost
    sed -i "s|NEXT_PUBLIC_SUPABASE_ANON_KEY=.*|NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY|g" .env.local
    sed -i "s|SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY|g" .env.local
    echo "✅ Environment updated with Supabase keys"
fi

# Generate types if they don't exist
if [ ! -f "src/types/supabase.ts" ] || [ -z "$(cat src/types/supabase.ts 2>/dev/null)" ]; then
    echo "🔧 Generating TypeScript types..."
    npm run supabase:types
fi

# Show Supabase status
echo ""
echo "📊 Supabase Status:"
npx supabase status | grep -E "(API|Studio|DB|Anon|Service)" || npx supabase status

echo ""
echo "✅ Environment ready!"
echo ""
if [ "$CODESPACES" = "true" ]; then
    echo "🎯 Your Codespace URLs:"
    echo "   🚀 Next.js:         https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
    echo "   🗄️  Supabase Studio: https://${CODESPACE_NAME}-54323.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
    echo "   🔌 Supabase API:    https://${CODESPACE_NAME}-54321.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
    echo ""
    echo "💡 Start Next.js: npm run dev"
    echo "   Then click the 🌐 globe icon in the PORTS tab on port 3000"
else
    echo "🎯 Next steps:"
    echo "   1. Start Next.js: npm run dev"
    echo "   2. Open http://localhost:3000"
    echo "   3. Or use VS Code debugger (F5)"
    echo ""
    echo "📚 Useful URLs:"
    echo "   • Next.js app:      http://localhost:3000"
    echo "   • Supabase Studio:  http://localhost:54323"
    echo "   • Supabase API:     http://localhost:54321"
fi
echo ""
