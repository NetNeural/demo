#!/bin/bash
# Verify Deno Configuration for Supabase Functions

echo "======================================"
echo "Deno Configuration Verification"
echo "======================================"
echo ""

# Check if Deno is installed
if ! command -v deno &> /dev/null; then
    echo "❌ Deno is not installed"
    echo "   Install from: https://deno.land/"
    exit 1
fi

echo "✅ Deno version: $(deno --version | head -1)"
echo ""

# Check if deno.json exists
if [ ! -f "supabase/functions/deno.json" ]; then
    echo "❌ deno.json not found in supabase/functions/"
    exit 1
fi

echo "✅ deno.json found"
echo ""

# Check VS Code settings
if [ ! -f ".vscode/settings.json" ]; then
    echo "⚠️  .vscode/settings.json not found (optional)"
else
    echo "✅ .vscode/settings.json exists"
    
    if grep -q "deno.enable" .vscode/settings.json; then
        echo "   ✓ Deno enabled in workspace settings"
    else
        echo "   ⚠️  Deno not configured in workspace settings"
    fi
fi
echo ""

# Check if Deno extension settings exist
if [ ! -f "supabase/functions/.vscode/settings.json" ]; then
    echo "⚠️  supabase/functions/.vscode/settings.json not found (optional)"
else
    echo "✅ Deno-specific settings configured for functions directory"
fi
echo ""

# Test Deno can check a function
echo "Testing Deno type checking..."
cd supabase/functions

if deno check integrations/index.ts 2>&1 | grep -q "error"; then
    echo "❌ Deno check found errors"
    deno check integrations/index.ts
    exit 1
else
    echo "✅ Deno type checking passed for integrations/index.ts"
fi

cd ../..

echo ""
echo "======================================"
echo "✅ Deno configuration is correct!"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Reload VS Code: Ctrl+Shift+P → 'Developer: Reload Window'"
echo "2. Open supabase/functions/integrations/index.ts"
echo "3. Check bottom-right status bar for 'Deno: Enabled'"
echo "4. Verify no TypeScript errors in Problems tab"
echo ""
