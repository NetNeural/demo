#!/bin/bash
# Quick start script for development environment
# Ensures everything is configured and running

set -e

echo ""
echo "🚀 Starting NetNeural Development Environment"
echo ""

# Change to development directory
cd "$(dirname "$0")"

# Configure environment for Codespaces if needed
if [ -n "$CODESPACE_NAME" ]; then
    echo "📍 Codespace detected: $CODESPACE_NAME"
    bash ../.devcontainer/configure-env.sh
fi

# Check if Supabase is running
echo "🔍 Checking Supabase status..."
if ! npx supabase status &>/dev/null; then
    echo "⚡ Starting Supabase..."
    npx supabase start
else
    echo "✅ Supabase is already running"
fi

echo ""
echo "🎯 Starting Next.js development server..."
echo ""
echo "📱 Your app will be available at:"
if [ -n "$CODESPACE_NAME" ]; then
    echo "   https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
else
    echo "   http://localhost:3000"
fi
echo ""

# Start Next.js (this will block)
npm run dev
