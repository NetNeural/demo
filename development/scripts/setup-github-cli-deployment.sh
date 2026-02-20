#!/bin/bash

# GitHub CLI Deployment Setup Script
# Helps configure GitHub CLI for triggering workflow dispatches

set -e

echo "========================================"
echo "GitHub CLI Deployment Setup"
echo "========================================"
echo ""

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

# Check current authentication
echo "📋 Current GitHub CLI authentication:"
gh auth status 2>&1 || true
echo ""

# Check if using Codespaces token
CURRENT_TOKEN=$(gh auth token 2>/dev/null || echo "")
if [[ "$CURRENT_TOKEN" == ghu_* ]]; then
    echo "⚠️  You're using a Codespaces token (ghu_*)"
    echo "   This token doesn't have permission to trigger workflows."
    echo ""
    echo "You need to create a Personal Access Token (PAT) with 'workflow' scope."
    echo ""
elif [[ "$CURRENT_TOKEN" == github_pat_* ]]; then
    echo "✅ You're using a Personal Access Token (PAT)"
    echo ""
    
    # Test if current token can trigger workflows
    echo "🧪 Testing workflow dispatch permission..."
    if gh workflow run deploy-staging.yml -f force_deploy=false 2>&1 | grep -q "403"; then
        echo "❌ Current token doesn't have workflow dispatch permission"
        echo ""
    else
        echo "✅ Token has workflow dispatch permission!"
        echo ""
        echo "You're all set! You can now deploy with:"
        echo "  gh workflow run deploy-staging.yml -f force_deploy=true"
        echo ""
        exit 0
    fi
else
    echo "⚠️  Unknown token type"
    echo ""
fi

# Provide setup instructions
echo "========================================"
echo "Setup Instructions"
echo "========================================"
echo ""
echo "1. Create a Personal Access Token:"
echo "   • Go to: https://github.com/settings/tokens?type=beta"
echo "   • Click 'Generate new token' (fine-grained)"
echo "   • Name: MonoRepo-Staging Deployments"
echo "   • Repository: NetNeural/MonoRepo-Staging"
echo "   • Permissions:"
echo "     - Actions: Read and write"
echo "     - Contents: Read"
echo ""
echo "2. Copy the token (starts with 'github_pat_')"
echo ""
echo "3. Run: gh auth login"
echo "   • Choose HTTPS protocol"
echo "   • Choose 'Paste an authentication token'"
echo "   • Paste your token"
echo ""
echo "4. Verify: gh auth status"
echo ""
echo "5. Deploy: gh workflow run deploy-staging.yml -f force_deploy=true"
echo ""
echo "========================================"
echo ""
echo "For detailed instructions, see:"
echo "  development/docs/GITHUB_CLI_DEPLOYMENT_SETUP.md"
echo ""
echo "Would you like to start the authentication process now? (y/n)"
read -r response

if [[ "$response" == "y" || "$response" == "Y" ]]; then
    echo ""
    echo "Starting GitHub CLI authentication..."
    echo "Follow the prompts to paste your Personal Access Token."
    echo ""
    gh auth login
    echo ""
    echo "✅ Authentication complete!"
    echo ""
    echo "Testing workflow dispatch..."
    if gh workflow run deploy-staging.yml -f force_deploy=false 2>&1 | grep -q "403"; then
        echo "❌ Still getting permission errors. Check token permissions."
    else
        echo "✅ Success! You can now deploy with:"
        echo "  gh workflow run deploy-staging.yml -f force_deploy=true"
    fi
else
    echo "Setup cancelled. Run this script again when ready."
fi
