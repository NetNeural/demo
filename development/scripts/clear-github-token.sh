#!/bin/bash

# Clear GITHUB_TOKEN and authenticate with GitHub CLI
# This allows gh CLI to use stored credentials with proper permissions

echo "========================================"
echo "GitHub Token Cleanup & Authentication"
echo "========================================"
echo ""

# Unset GITHUB_TOKEN in current session
unset GITHUB_TOKEN
echo "✅ Cleared GITHUB_TOKEN from current session"
echo ""

# Check if any stored credentials exist
echo "📋 Current authentication status:"
gh auth status 2>&1 || echo "   No stored credentials found"
echo ""

echo "To persist this change across terminal sessions, add to ~/.bashrc:"
echo "  unset GITHUB_TOKEN"
echo ""
echo "Would you like to add it now? (y/n)"
read -r response

if [[ "$response" == "y" || "$response" == "Y" ]]; then
    if ! grep -q "unset GITHUB_TOKEN" ~/.bashrc 2>/dev/null; then
        echo "" >> ~/.bashrc
        echo "# Clear Codespaces token to use gh CLI stored credentials" >> ~/.bashrc
        echo "unset GITHUB_TOKEN" >> ~/.bashrc
        echo "✅ Added to ~/.bashrc"
    else
        echo "✅ Already in ~/.bashrc"
    fi
    echo ""
fi

echo "========================================"
echo "Next Steps"
echo "========================================"
echo ""
echo "1. Create a Personal Access Token:"
echo "   https://github.com/settings/tokens?type=beta"
echo ""
echo "   Configuration:"
echo "   • Name: MonoRepo-Staging Deployments"
echo "   • Repository: NetNeural/MonoRepo-Staging"
echo "   • Permissions:"
echo "     - Actions: Read and write"
echo "     - Contents: Read"
echo ""
echo "2. Authenticate GitHub CLI:"
echo "   gh auth login"
echo ""
echo "   • Choose: HTTPS"
echo "   • Choose: Paste an authentication token"
echo "   • Paste your token"
echo ""
echo "Would you like to start authentication now? (y/n)"
read -r auth_response

if [[ "$auth_response" == "y" || "$auth_response" == "Y" ]]; then
    echo ""
    gh auth login
    echo ""
    echo "✅ Authentication complete!"
    echo ""
    echo "You can now deploy with:"
    echo "  gh workflow run deploy-staging.yml -f force_deploy=true"
else
    echo ""
    echo "Run 'gh auth login' when you're ready."
fi
