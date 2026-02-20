# GitHub CLI Deployment Setup

## Problem
The default GitHub Codespaces token (`ghu_*`) doesn't have permission to trigger workflow dispatches, resulting in:
```
HTTP 403: Resource not accessible by integration
```

## Solution
Create and use a Personal Access Token (PAT) with proper permissions.

### Step 1: Create a Personal Access Token

1. **Go to**: https://github.com/settings/tokens?type=beta

2. **Click** "Generate new token" (fine-grained token)

3. **Configure the token**:
   - **Token name**: `MonoRepo-Staging Deployments`
   - **Expiration**: 90 days (or as needed)
   - **Repository access**: Select "Only select repositories"
     - Choose: `NetNeural/MonoRepo-Staging`

4. **Repository permissions** (expand and set):
   - **Actions**: Read and write ✓
   - **Contents**: Read ✓
   - **Metadata**: Read (automatically set)

5. **Click** "Generate token"

6. **Copy the token** (it starts with `github_pat_`)

### Step 2: Authenticate GitHub CLI

Run in your terminal:

```bash
# Log out of current session
gh auth logout

# Login with the new token
gh auth login

# Follow the prompts:
# - What account do you want to log into? GitHub.com
# - What is your preferred protocol? HTTPS
# - Authenticate Git with your GitHub credentials? Yes
# - How would you like to authenticate? Paste an authentication token
# - Paste your token: [paste the token you copied]
```

### Step 3: Verify Authentication

```bash
gh auth status
```

You should see your username (not GITHUB_TOKEN).

### Step 4: Test Deployment

```bash
gh workflow run deploy-staging.yml -f force_deploy=true
```

## Alternative: Manual Deployment

If you prefer not to set up token authentication, you can always deploy manually via the GitHub UI:

1. Go to: https://github.com/NetNeural/MonoRepo-Staging/actions/workflows/deploy-staging.yml
2. Click "Run workflow"
3. Select branch: `main`
4. Check `force_deploy` if needed
5. Click "Run workflow"

## Security Notes

- **Never commit tokens** to git repositories
- **Store tokens securely** (use password managers)
- **Rotate tokens regularly** (every 90 days recommended)
- **Use minimal permissions** (only what's needed)
- **Revoke tokens** when no longer needed

## Troubleshooting

### Token still doesn't work
- Verify repository access includes `NetNeural/MonoRepo-Staging`
- Verify Actions permissions is set to "Read and write"
- Try logging out and back in: `gh auth logout && gh auth login`

### Lost token
- Generate a new one (old token is revoked when lost)
- Follow Step 1-2 again

### Want to use different account
```bash
gh auth switch
```
