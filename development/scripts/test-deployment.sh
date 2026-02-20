#!/bin/bash
# Deployment Test & Fix Script

set -e

echo "======================================"
echo "Deployment Diagnostic & Fix Script"
echo "======================================"
echo ""

# 1. Check git status
echo "1️⃣ Checking git status..."
cd /workspaces/MonoRepo
git status
echo ""

# 2. Check recent commits
echo "2️⃣ Recent commits (local):"
git log --oneline -3
echo ""

# 3. Check remote commits
echo "3️⃣ Recent commits (remote):"
git log origin/main --oneline -3 2>/dev/null || echo "⚠️  Cannot fetch remote commits"
echo ""

# 4. Verify workflow files exist
echo "4️⃣ Checking workflow files..."
if [ -f ".github/workflows/test.yml" ]; then
    echo "✅ test.yml exists"
else
    echo "❌ test.yml missing"
fi

if [ -f ".github/workflows/deploy-staging.yml" ]; then
    echo "✅ deploy-staging.yml exists"
else
    echo "❌ deploy-staging.yml missing"
fi
echo ""

# 5. Check if workflows are committed
echo "5️⃣ Verifying workflows are committed..."
git ls-files .github/workflows/ | head -5
echo ""

# 6. Test GitHub CLI connection
echo "6️⃣ Testing GitHub CLI connection..."
if command -v gh &> /dev/null; then
    echo "✅ GitHub CLI installed"
    gh auth status 2>&1 | head -3 || echo "⚠️  GitHub CLI not authenticated"
else
    echo "❌ GitHub CLI not installed"
fi
echo ""

# 7. Try to fetch latest from remote
echo "7️⃣ Fetching from remote..."
git fetch origin main
echo ""

# 8. Check if local is ahead of remote
echo "8️⃣ Checking local vs remote..."
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u} 2>/dev/null || echo "")
if [ "$LOCAL" = "$REMOTE" ]; then
    echo "✅ Local and remote are in sync"
elif [ -z "$REMOTE" ]; then
    echo "⚠️  Cannot determine remote state"
else
    echo "⚠️  Local is different from remote"
    echo "   Local:  $LOCAL"
    echo "   Remote: $REMOTE"
fi
echo ""

# 9. Offer to push if needed
echo "9️⃣ Checking unpushed commits..."
UNPUSHED=$(git log origin/main..HEAD --oneline 2>/dev/null | wc -l)
if [ "$UNPUSHED" -gt 0 ]; then
    echo "⚠️  $UNPUSHED unpushed commit(s) found"
    echo ""
    git log origin/main..HEAD --oneline
    echo ""
    read -p "Push to origin/main? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Pushing to origin/main..."
        git push origin main
        echo "✅ Pushed successfully"
    fi
else
    echo "✅ No unpushed commits"
fi
echo ""

# 10. Try to trigger workflows manually
echo "🔟 Attempting to trigger workflows..."
if command -v gh &> /dev/null; then
    echo "Triggering test workflow..."
    gh workflow run test.yml 2>&1 || echo "⚠️  Could not trigger test workflow"
    
    echo "Triggering staging deployment..."
    gh workflow run deploy-staging.yml -f force_deploy=true 2>&1 || echo "⚠️  Could not trigger staging deployment"
    
    echo ""
    echo "Checking recent workflow runs..."
    gh run list --limit 3 2>&1 || echo "⚠️  Could not list workflow runs"
else
    echo "⚠️  GitHub CLI not available - cannot trigger workflows manually"
    echo "   Install with: sudo apt-get install gh"
fi
echo ""

# 11. Summary and next steps
echo "======================================"
echo "Summary & Next Steps"
echo "======================================"
echo ""
echo "✅ COMPLETED CHECKS"
echo ""
echo "🔍 View workflows at:"
echo "   https://github.com/NetNeural/MonoRepo-Staging/actions"
echo ""
echo "📋 If workflows still not appearing:"
echo "   1. Check repository settings → Actions → General"
echo "   2. Ensure 'Allow all actions' is enabled"
echo "   3. Verify branch protection rules allow Actions"
echo "   4. Check if GitHub Actions minutes are available"
echo ""
echo "🚀 Expected deployment URL:"
echo "   https://demo-stage.netneural.ai/dashboard/devices/"
echo ""
