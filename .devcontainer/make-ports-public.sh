#!/bin/bash
# Automatically make Codespaces ports public
# Runs on postStartCommand and postAttachCommand

if [ -z "$CODESPACE_NAME" ]; then
    # Not in Codespaces, skip silently
    exit 0
fi

echo ""
echo "🌐 Making Codespaces ports public..."

# Set ports to public (ignore errors if ports don't exist yet)
gh codespace ports visibility 3000:public 54321:public 54323:public 54324:public --codespace "$CODESPACE_NAME" 2>/dev/null || true

echo ""
echo "✅ Development ports configured!"
echo ""
echo "📱 Your public URLs:"
echo ""
echo "   🚀 Next.js:         https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
echo "   🗄️  Supabase Studio: https://${CODESPACE_NAME}-54323.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
echo "   🔌 Supabase API:    https://${CODESPACE_NAME}-54321.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
echo ""
echo "💡 Quick start:"
echo "   cd development"
echo "   npx supabase start  # if not running"
echo "   npm run dev         # start Next.js"
echo ""

# Always exit successfully
exit 0
