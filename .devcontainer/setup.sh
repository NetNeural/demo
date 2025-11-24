#!/bin/bash
# Note: We don't use 'set -e' to allow the script to continue even if some steps fail
# This prevents Codespace setup from completely failing on non-critical errors

echo "🚀 Setting up NetNeural IoT Platform Development Environment..."

# Note: Supabase CLI will be installed via npx on first use
# This avoids installation issues and always uses the latest version
echo "📦 Supabase CLI will be installed via npx on first use..."

# Navigate to development directory
cd /workspaces/MonoRepo/development || exit 1

# Install Node dependencies
echo "📦 Installing Node.js dependencies..."
npm install --no-audit --prefer-offline || {
    echo "⚠️  npm install failed, trying with legacy peer deps..."
    npm install --legacy-peer-deps --no-audit --prefer-offline || echo "⚠️  npm install failed, continuing..."
}

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    echo "⚙️  Creating .env.local from template..."
    cp .env.local.template .env.local
    
    # Update URLs for Codespaces if applicable
    if [ "$CODESPACES" = "true" ]; then
        echo "🌐 Configuring for GitHub Codespaces..."
        # Browser needs public forwarded URL, server can use localhost
        CODESPACE_SUPABASE_URL="https://${CODESPACE_NAME}-54321.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
        sed -i "s|NEXT_PUBLIC_SUPABASE_URL=.*|NEXT_PUBLIC_SUPABASE_URL=$CODESPACE_SUPABASE_URL|g" .env.local
        # Server-side still uses localhost (faster, no SSL overhead)
        sed -i 's|SUPABASE_URL=.*|SUPABASE_URL=http://127.0.0.1:54321|g' .env.local
    fi
fi

# Note: We skip starting Supabase automatically to avoid hanging postCreateCommand
# Supabase takes 30-60 seconds to start and can hang in Codespaces
echo "⏭️  Skipping automatic Supabase start (prevents hanging)"
echo "   You can start Supabase when ready with: npx supabase start"
SUPABASE_FAILED=true

# Don't extract keys since Supabase isn't running
ANON_KEY=""
SERVICE_KEY=""

echo "⚠️  Note: .env.local will use placeholder keys until you start Supabase"
echo "   After starting Supabase, keys will be auto-detected on first 'npm run dev'"

# Port visibility is now automated via devcontainer.json portsAttributes
# No manual configuration needed!

echo ""
echo "⚠️  Setup completed - Supabase not started (prevents hanging)"
echo ""
echo "🔧 To finish setup and start development:"
echo "   cd development"
echo "   npx supabase start    # Takes 30-60 seconds"
echo "   npm run dev           # Start Next.js"
echo ""

echo "🎯 Development workflow:"
echo "   1. Start Supabase: npx supabase start (in development/ dir)"
echo "   2. Start Next.js:  npm run dev"
if [ "$CODESPACES" = "true" ]; then
    echo "   3. Access Next.js via PORTS tab (port 3000)"
    echo "   4. Access Supabase Studio via PORTS tab (port 54323)"
else
    echo "   3. Open http://localhost:3000 (Next.js)"
    echo "   4. Open http://localhost:54323 (Supabase Studio)"
fi
echo ""
echo "📚 Useful commands:"
echo "   npm run dev:full:debug  - Start with VS Code debugger"
echo "   npm run test            - Run Jest tests"
echo "   npm run supabase:status - Check Supabase services"
echo "   npm run supabase:types  - Regenerate TypeScript types"
echo ""

# Always exit successfully to prevent Codespace creation failure
exit 0
