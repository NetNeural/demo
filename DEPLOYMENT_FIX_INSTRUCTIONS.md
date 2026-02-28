# 🔍 Deployment Diagnostic & Fix Guide

## Issue Summary
- "Add Device" feature code was created and committed
- Tests failing due to missing `@testing-library/dom` dependency
- Workflow runs not appearing in GitHub Actions
- Need to get changes deployed to https://demo-stage.netneural.ai

## Quick Fix - Run These Commands

### 1️⃣ Verify Current Status
```bash
cd /workspaces/MonoRepo

# Check git status
git status

# Check recent commits
git log --oneline -5

# Check remote status
git fetch origin main
git log origin/main --oneline -5
```

### 2️⃣ Install Dependencies
```bash
cd /workspaces/MonoRepo/development

# Install all dependencies (including @testing-library/dom)
npm ci --ignore-scripts

# Verify @testing-library/dom is installed
npm list @testing-library/dom
```

### 3️⃣ Run Tests Locally
```bash
# Run type check
npm run type-check

# Run linter
npm run lint

# Run tests
npm test
```

**Expected Result:** Tests should pass now that @testing-library/dom is installed

### 4️⃣ Check GitHub Workflows
```bash
# Check if gh CLI is working
gh auth status

# List recent workflow runs
gh run list --limit 5

# View all workflows
gh workflow list
```

### 5️⃣ Manually Trigger Workflows
```bash
# Trigger test workflow
gh workflow run test.yml

# Wait ~2 minutes, then check status
gh run list --limit 3

# If tests pass, trigger staging deployment
gh workflow run deploy-staging.yml -f force_deploy=true

# Monitor deployment
gh run watch
```

### 6️⃣ View Workflows in Browser
Open in browser:
```
https://github.com/NetNeural/MonoRepo-Staging/actions
```

Look for:
- ✅ "Run Tests" workflow should show green checkmark
- ✅ "Deploy Staging to GitHub Pages" should trigger after tests pass
- ⏱️ Deployment takes ~3-5 minutes

### 7️⃣ Verify Deployment
After deployment completes, check:
```
https://demo-stage.netneural.ai/dashboard/devices/
```

You should see the new "Add Device" button in the top right corner!

## Troubleshooting

### If workflows still don't appear:
1. **Check repository settings:**
   ```
   https://github.com/NetNeural/MonoRepo-Staging/settings/actions
   ```
   - Ensure "Allow all actions and reusable workflows" is enabled
   - Check if Actions are enabled for the repository

2. **Check branch protection:**
   ```
   https://github.com/NetNeural/MonoRepo-Staging/settings/branches
   ```
   - Ensure main branch allows Actions to run

3. **Verify GitHub Actions minutes:**
   ```
   https://github.com/settings/billing
   ```
   - Check if you have available Actions minutes

### If tests fail:
1. **Check error output:** Run `npm test` locally to see specific failures
2. **Missing dependencies:** Run `npm ci` to reinstall all packages
3. **Coverage issues:** New components need tests - see below

### If deployment fails:
1. **Check GitHub Secrets:**
   ```bash
   gh secret list
   ```
   Required secrets:
   - `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`

2. **Check build locally:**
   ```bash
   cd /workspaces/MonoRepo/development
   npm run build
   ```

## What Was Changed

### Files Created:
1. **`src/components/devices/AddDeviceDialog.tsx`** (265 lines)
   - New dialog component for adding devices
   - Form with validation
   - Supabase integration

### Files Modified:
2. **`src/components/devices/DevicesHeader.tsx`**
   - Added "Add Device" button with permission check
   - Integrated AddDeviceDialog component

3. **`src/components/devices/DevicesList.tsx`**
   - Added auto-refresh on device addition

4. **`package.json`**
   - Already includes `@testing-library/dom: ^10.4.0` (line 124)

## Known Issues & Next Steps

### ⚠️ Test Coverage
The new AddDeviceDialog component has **no test coverage** which may cause coverage checks to fail.

**Solution:** Create tests for the component:
```bash
# Create test file
touch src/components/devices/__tests__/AddDeviceDialog.test.tsx
```

Add test content:
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AddDeviceDialog } from '../AddDeviceDialog'

describe('AddDeviceDialog', () => {
  it('should render dialog when open', () => {
    render(<AddDeviceDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)
    expect(screen.getByText('Register New Device')).toBeInTheDocument()
  })

  it('should validate required fields', async () => {
    render(<AddDeviceDialog open={true} onOpenChange={() => {}} onSuccess={() => {}} />)
    
    const submitButton = screen.getByText('Create Device')
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText(/device name is required/i)).toBeInTheDocument()
    })
  })
})
```

Then run:
```bash
npm test -- AddDeviceDialog
```

## Quick Commands Reference

| Task | Command |
|------|---------|
| Install deps | `npm ci --ignore-scripts` |
| Run tests | `npm test` |
| Type check | `npm run type-check` |
| Lint | `npm run lint` |
| Build | `npm run build` |
| Trigger test workflow | `gh workflow run test.yml` |
| Trigger deploy | `gh workflow run deploy-staging.yml -f force_deploy=true` |
| Watch workflows | `gh run watch` |
| List runs | `gh run list` |

## Success Criteria

✅ Tests pass locally with `npm test`  
✅ Workflow runs appear at https://github.com/NetNeural/MonoRepo-Staging/actions  
✅ "Run Tests" workflow completes successfully  
✅ "Deploy Staging" workflow completes successfully  
✅ "Add Device" button visible at https://demo-stage.netneural.ai/dashboard/devices/  

---

**Last Updated:** 2025-11-13  
**Status:** Ready for manual execution  
**Estimated Time:** 5-10 minutes
