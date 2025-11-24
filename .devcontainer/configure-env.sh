#!/bin/bash
# Auto-configure environment for GitHub Codespaces
# This runs every time the Codespace starts to ensure correct URLs

set -e

if [ -z "$CODESPACE_NAME" ]; then
    echo "ℹ️  Not in Codespaces - using localhost configuration"
    exit 0
fi

echo ""
echo "🔧 Configuring development environment for Codespaces..."

# Extract domain from environment
DOMAIN="${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
if [ -z "$DOMAIN" ]; then
    DOMAIN="app.github.dev"
fi

# Build public URLs
NEXT_PUBLIC_URL="https://${CODESPACE_NAME}-3000.${DOMAIN}"
SUPABASE_API_URL="https://${CODESPACE_NAME}-54321.${DOMAIN}"
SUPABASE_STUDIO_URL="https://${CODESPACE_NAME}-54323.${DOMAIN}"

echo "   📍 Next.js Public URL:    $NEXT_PUBLIC_URL"
echo "   📍 Supabase API URL:      $SUPABASE_API_URL"
echo "   📍 Supabase Studio URL:   $SUPABASE_STUDIO_URL"

# Update .env.local with public URLs
ENV_FILE="/workspaces/MonoRepo/development/.env.local"

if [ ! -f "$ENV_FILE" ]; then
    echo "⚠️  .env.local not found, skipping environment configuration"
    exit 0
fi

# Use sed to update the URLs in place
sed -i "s|NEXT_PUBLIC_SUPABASE_URL=.*|NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_API_URL}|g" "$ENV_FILE"

echo "✅ Updated .env.local with Codespaces public URLs"

# Update Supabase config.toml
CONFIG_FILE="/workspaces/MonoRepo/development/supabase/config.toml"

if [ -f "$CONFIG_FILE" ]; then
    sed -i "s|api_url = \".*\"|api_url = \"${SUPABASE_API_URL}\"|g" "$CONFIG_FILE"
    sed -i "s|site_url = \".*\"|site_url = \"${NEXT_PUBLIC_URL}\"|g" "$CONFIG_FILE"
    
    # Update additional_redirect_urls to include both public and localhost
    sed -i "s|additional_redirect_urls = \[.*\]|additional_redirect_urls = [\"${NEXT_PUBLIC_URL}\", \"http://127.0.0.1:3000\"]|g" "$CONFIG_FILE"
    
    echo "✅ Updated supabase/config.toml with Codespaces URLs"
fi

echo ""
echo "🎉 Environment configured! Ready to develop."
echo ""

exit 0
