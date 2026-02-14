#!/bin/bash
# Test frontend connection to Supabase by checking the deployed build

echo "🧪 Testing frontend Supabase connection..."
echo ""

# Check if the frontend is using the correct Supabase URL
response=$(curl -s https://demo-stage.netneural.ai/)

if echo "$response" | grep -q "atgbmxicqikmapfqouco"; then
    echo "✅ Frontend is using correct Supabase project: atgbmxicqikmapfqouco"
else
    echo "⚠️  Frontend may not be using correct Supabase project"
    echo "   Looking for any Supabase URL references..."
    echo "$response" | grep -o 'supabase\.co[^"]*' | head -3
fi

echo ""
echo "🔐 Testing authentication endpoint..."
auth_response=$(curl -s -o /dev/null -w "%{http_code}" https://atgbmxicqikmapfqouco.supabase.co/auth/v1/health)

if [ "$auth_response" = "200" ]; then
    echo "✅ Supabase auth endpoint is accessible (HTTP $auth_response)"
else
    echo "⚠️  Supabase auth endpoint returned: $auth_response"
fi

echo ""
echo "📋 Next steps:"
echo "1. Open incognito window: https://demo-stage.netneural.ai/"
echo "2. Try logging in with: admin@netneural.ai / Admin123!"
echo "3. Check browser console (F12) for any errors"
echo ""
echo "If login fails, check browser console for:"
echo "  - Which Supabase URL is being used"
echo "  - Any 'Invalid API key' errors"
