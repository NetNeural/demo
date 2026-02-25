#!/bin/bash
# Check today's GitHub Actions builds and push any uncommitted changes to staging

set -e
cd "$(git rev-parse --show-toplevel)"

TODAY=$(date -u +%Y-%m-%d)
REPO="NetNeural/MonoRepo-Staging"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 TODAY'S GITHUB ACTIONS BUILDS ($TODAY)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# List today's runs
gh run list --repo "$REPO" --limit 50 --json name,status,conclusion,createdAt,databaseId,displayTitle \
  --jq ".[] | select(.createdAt | startswith(\"$TODAY\")) | \"\(.databaseId) | \(.conclusion // .status | ascii_downcase | .[0:12]) | \(.name[0:35]) | \(.displayTitle[0:45])\""

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 UNCOMMITTED / UNPUSHED CHANGES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

UNSTAGED=$(git diff --name-only)
STAGED=$(git diff --cached --name-only)
UNTRACKED=$(git ls-files --others --exclude-standard | grep -v node_modules | grep -v ".next" | grep -v "dist/")
UNPUSHED=$(git log origin/main..HEAD --oneline 2>/dev/null)

if [ -n "$UNSTAGED" ]; then
  echo "🟡 Modified (not staged):"
  echo "$UNSTAGED" | sed 's/^/   /'
  echo ""
fi

if [ -n "$STAGED" ]; then
  echo "🟠 Staged (not committed):"
  echo "$STAGED" | sed 's/^/   /'
  echo ""
fi

if [ -n "$UNTRACKED" ]; then
  echo "⚪ Untracked files:"
  echo "$UNTRACKED" | sed 's/^/   /'
  echo ""
fi

if [ -n "$UNPUSHED" ]; then
  echo "🔵 Committed but not pushed:"
  echo "$UNPUSHED" | sed 's/^/   /'
  echo ""
fi

if [ -z "$UNSTAGED" ] && [ -z "$STAGED" ] && [ -z "$UNPUSHED" ]; then
  echo "✅ Everything is clean and pushed."
  echo ""
fi

# Check for failed builds today
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
FAILED=$(gh run list --repo "$REPO" --limit 50 --json status,conclusion,createdAt,databaseId,name \
  --jq ".[] | select(.createdAt | startswith(\"$TODAY\")) | select(.conclusion == \"failure\") | .databaseId")

if [ -n "$FAILED" ]; then
  echo "❌ FAILED BUILDS TODAY — retrigger? (y/n)"
  read -r answer
  if [ "$answer" = "y" ]; then
    gh workflow run deploy-staging.yml --repo "$REPO"
    echo "✅ Workflow triggered!"
  fi
else
  echo "✅ No failed builds today."
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Offer to commit and push pending changes
HAS_CHANGES=$(git status --porcelain | grep -v node_modules | grep -v ".next" | grep -v "dist/" | head -1)
if [ -n "$HAS_CHANGES" ]; then
  echo ""
  echo "📦 Push all pending changes to staging? (y/n)"
  read -r answer
  if [ "$answer" = "y" ]; then
    echo ""
    echo "Files to commit:"
    git status --short | grep -v node_modules | grep -v ".next"
    echo ""
    echo "Enter commit message (or press Enter for default):"
    read -r msg
    msg=${msg:-"chore: push pending local changes to staging"}

    git add -A -- ':!node_modules' ':!*/node_modules' ':!.next' ':!*/dist'
    git commit -m "$msg"
    git push origin main
    echo ""
    echo "✅ Pushed! GitHub Actions will deploy to demo-stage.netneural.ai"
    echo "   Watch: https://github.com/$REPO/actions"
  fi
fi
