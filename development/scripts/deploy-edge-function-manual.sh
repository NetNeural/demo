#!/bin/bash

# Deploy members edge function to staging manually
# This script is needed because GitHub Actions workflow has Supabase CLI steps commented out

echo "🚀 Deploying members edge function to staging..."
echo ""
echo "⚠️  IMPORTANT: You need a Supabase Access Token"
echo "   Get it from: https://supabase.com/dashboard/account/tokens"
echo ""

# Check if SUPABASE_ACCESS_TOKEN is set
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "❌ Error: SUPABASE_ACCESS_TOKEN environment variable is not set"
  echo ""
  echo "To deploy, run:"
  echo "  export SUPABASE_ACCESS_TOKEN='your-token-here'"
  echo "  ./scripts/deploy-edge-function-manual.sh"
  exit 1
fi

# Staging project details
PROJECT_REF="atgbmxicqikmapfqouco"

echo "📋 Project: $PROJECT_REF"
echo "🔧 Function: members"
echo ""

# Link to project
echo "🔗 Linking to staging project..."
npx supabase link --project-ref $PROJECT_REF

if [ $? -ne 0 ]; then
  echo "❌ Failed to link to project"
  exit 1
fi

# Deploy specific edge function
echo ""
echo "📤 Deploying members edge function..."
npx supabase functions deploy members --no-verify-jwt

if [ $? -ne 0 ]; then
  echo "❌ Failed to deploy edge function"
  exit 1
fi

echo ""
echo "✅ Successfully deployed members edge function to staging!"
echo ""
echo "🧪 Test it at: https://demo-stage.netneural.ai/dashboard/organizations/"
