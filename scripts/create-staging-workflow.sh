#!/bin/bash
# Create GitHub Actions Workflow for Staging Deployment
# Usage: ./scripts/create-staging-workflow.sh

set -e

echo "🔧 Creating Staging Deployment Workflow"
echo "========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

WORKFLOW_FILE="/workspaces/MonoRepo/.github/workflows/deploy-staging.yml"

echo -e "${BLUE}📝 Creating $WORKFLOW_FILE...${NC}"

cat > "$WORKFLOW_FILE" << 'EOF'
name: Deploy to Staging (demo-stage.netneural.ai)

on:
  push:
    branches: [staging]
    paths: ['development/**']
  workflow_dispatch:
    inputs:
      force_deploy:
        description: 'Force deployment even if no changes'
        required: false
        default: 'false'
        type: boolean

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "staging-deployment"
  cancel-in-progress: false

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://demo-stage.netneural.ai
    
    defaults:
      run:
        working-directory: ./development
    
    steps:
      - name: 📥 Checkout staging branch
        uses: actions/checkout@v4
        with:
          ref: staging

      - name: 🔧 Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: './development/package-lock.json'

      - name: 📦 Install dependencies
        run: npm ci --ignore-scripts

      - name: 🏗️ Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: 🔗 Link to Staging Supabase
        run: npx supabase link --project-ref ${{ secrets.STAGING_SUPABASE_PROJECT_ID }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.STAGING_SUPABASE_ACCESS_TOKEN }}

      - name: 📤 Push database migrations
        run: npx supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.STAGING_SUPABASE_ACCESS_TOKEN }}
        continue-on-error: false

      - name: 🚀 Deploy edge functions
        run: npx supabase functions deploy --no-verify-jwt
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.STAGING_SUPABASE_ACCESS_TOKEN }}
        continue-on-error: false

      - name: 📝 Generate TypeScript types
        run: npx supabase gen types typescript --linked > src/lib/database.types.ts
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.STAGING_SUPABASE_ACCESS_TOKEN }}

      - name: 🔍 Type check
        run: npm run type-check
        continue-on-error: true

      - name: 🧹 Lint code
        run: npm run lint
        continue-on-error: true

      - name: 🧪 Run tests
        run: npm test
        continue-on-error: true

      - name: ✅ Verify environment
        env:
          NODE_ENV: staging
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.STAGING_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.STAGING_SUPABASE_ANON_KEY }}
          GOLIOTH_API_KEY: ${{ secrets.STAGING_GOLIOTH_API_KEY }}
        run: |
          echo "🔍 Staging Environment Configuration:"
          echo "NODE_ENV: $NODE_ENV"
          echo "NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}"
          echo "NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY:0:20}..."
          echo "GOLIOTH_API_KEY: ${GOLIOTH_API_KEY:0:10}..."
          echo "Target: demo-stage.netneural.ai"
          echo "Project: ${{ secrets.STAGING_SUPABASE_PROJECT_ID }}"

      - name: 🏗️ Build application
        env:
          NODE_ENV: staging
          BUILD_MODE: static
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.STAGING_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.STAGING_SUPABASE_ANON_KEY }}
          GOLIOTH_API_KEY: ${{ secrets.STAGING_GOLIOTH_API_KEY }}
          GOLIOTH_PROJECT_ID: ${{ secrets.GOLIOTH_PROJECT_ID }}
          NEXT_PUBLIC_APP_URL: "https://demo-stage.netneural.ai"
          NEXT_PUBLIC_APP_NAME: "NetNeural IoT Platform [STAGING]"
          NEXT_PUBLIC_APP_VERSION: "1.0.0-staging"
        run: |
          echo "🚀 Building NetNeural Platform for staging..."
          echo "Target: demo-stage.netneural.ai"
          
          # Remove API routes (incompatible with static export)
          rm -rf src/app/api
          
          # Disable instrumentation for static build
          mv instrumentation.ts instrumentation.ts.disabled 2>/dev/null || true
          
          # Clean build artifacts
          rm -rf .next out
          
          # Build static site
          npm run build
          
          echo "✅ Build completed!"
          echo "📁 Output:"
          ls -la out/
          
          # Copy CNAME for custom domain
          cp public/CNAME.staging out/CNAME
          echo "✅ CNAME configured for demo-stage.netneural.ai"

      - name: 📤 Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './development/out'

      - name: 🚀 Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4

      - name: ✅ Deployment Success
        if: success()
        run: |
          echo "🎉 Staging deployment successful!"
          echo "🌐 URL: https://demo-stage.netneural.ai"
          echo "📊 GitHub Pages: ${{ steps.deployment.outputs.page_url }}"
          echo "🗄️ Database: ${{ secrets.STAGING_SUPABASE_URL }}"

      - name: 🔍 Post-Deployment Verification
        if: success()
        run: |
          echo "Waiting for DNS propagation (30s)..."
          sleep 30
          
          echo "Testing staging endpoint..."
          response=$(curl -s -o /dev/null -w "%{http_code}" https://demo-stage.netneural.ai || echo "000")
          
          if [ "$response" = "200" ]; then
            echo "✅ Staging site is live!"
          else
            echo "⚠️ Staging site returned status: $response"
            echo "   DNS may still be propagating"
          fi

      - name: 📧 Notify on Failure
        if: failure()
        run: |
          echo "❌ Staging deployment failed!"
          echo "Check logs: https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}"
EOF

echo -e "${GREEN}✅ Created staging deployment workflow${NC}"
echo ""
echo -e "${BLUE}📋 Workflow details:${NC}"
echo "   File: .github/workflows/deploy-staging.yml"
echo "   Trigger: Push to staging branch"
echo "   Target: https://demo-stage.netneural.ai"
echo "   Environment: staging (uses STAGING_* secrets)"
echo ""
echo -e "${GREEN}🎉 Workflow creation complete!${NC}"
echo ""
echo -e "${BLUE}Test the workflow:${NC}"
echo "  1. Create staging branch: git checkout -b staging"
echo "  2. Push to GitHub: git push origin staging"
echo "  3. Monitor: gh run watch"
echo ""
