#!/bin/bash

# Deploy organizations edge function to staging with improved logging

echo "🚀 Deploying organizations edge function to staging..."
echo ""

# Check if SUPABASE_ACCESS_TOKEN is set
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "❌ Error: SUPABASE_ACCESS_TOKEN environment variable is not set"
  echo ""
  echo "To deploy, run:"
  echo "  export SUPABASE_ACCESS_TOKEN='your-token-here'"
  echo "  ./scripts/deploy-organizations-function.sh"
  exit 1
fi

# Staging project details
PROJECT_REF="atgbmxicqikmapfqouco"

echo "📋 Project: $PROJECT_REF"
echo "🔧 Function: organizations"
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
echo "📤 Deploying organizations edge function..."
npx supabase functions deploy organizations --no-verify-jwt

if [ $? -ne 0 ]; then
  echo "❌ Failed to deploy edge function"
  exit 1
fi

echo ""
echo "✅ Successfully deployed organizations edge function to staging!"
echo ""
echo "📊 To view logs:"
echo "  npx supabase functions logs organizations --project-ref atgbmxicqikmapfqouco"
echo ""
