# Branch Protection Rules - Setup Guide

This document describes the recommended branch protection rules for the NetNeural MonoRepo to ensure code quality and prevent accidental deployments.

## Prerequisites

**Required Permissions**: Organization/Repository Admin access

Branch protection rules require administrator-level permissions. If you don't have these permissions, share this document with your repository administrator.

## Recommended Branch Protection Configuration

### Main Branch (`main`)

The main branch should have the following protection rules enabled:

#### 1. Require Pull Request Reviews
- ✅ **Enable**: Require pull request reviews before merging
- **Reviewers Required**: 1
- ✅ **Dismiss stale reviews**: When new commits are pushed
- ✅ **Require review from Code Owners**: (if CODEOWNERS file exists)
- ⚠️ **Optional**: Allow specified actors to bypass pull request requirements (for emergency hotfixes)

#### 2. Require Status Checks
- ✅ **Enable**: Require status checks to pass before merging
- ✅ **Require branches to be up to date**: Ensures branch is current before merge

**Required Status Checks** (must pass):
```
test-summary          # Master check that depends on all tests
Unit Tests            # Jest unit tests with 70% coverage
Type Safety Check     # TypeScript compilation
Lint Check            # ESLint + Prettier
Production Build      # Next.js build validation
```

**Optional Status Checks** (recommended but not blocking):
```
E2E Tests             # Playwright integration tests (on main branch)
codecov/project       # Codecov coverage report
codecov/patch         # Codecov patch coverage
```

#### 3. Require Conversation Resolution
- ✅ **Enable**: Require conversation resolution before merging
- Ensures all PR comments are addressed

#### 4. Require Signed Commits
- ⚠️ **Optional**: Require signed commits (GPG/SSH signatures)
- Recommended for high-security environments

#### 5. Require Linear History
- ⚠️ **Optional**: Require linear history (prevents merge commits)
- Recommended: Disable (allow merge commits for flexibility)

#### 6. Include Administrators
- ✅ **Enable**: Include administrators (applies rules to admins too)
- Ensures quality gates apply to everyone

#### 7. Restrict Push Access
- ✅ **Enable**: Restrict who can push to matching branches
- **Allowed**: No one (all changes must go through PRs)
- **Exceptions**: CI/CD service accounts (GitHub Actions)

#### 8. Force Push Protection
- ✅ **Enable**: Do not allow force pushes
- Prevents history rewriting on main branch

#### 9. Branch Deletion Protection
- ✅ **Enable**: Do not allow deletion
- Prevents accidental deletion of main branch

## Setup Instructions

### Via GitHub Web Interface

1. Navigate to your repository on GitHub
2. Go to **Settings** → **Branches**
3. Under "Branch protection rules", click **Add rule**
4. In "Branch name pattern", enter: `main`
5. Configure the following options:

```
☑ Require a pull request before merging
  ☑ Require approvals: 1
  ☑ Dismiss stale pull request approvals when new commits are pushed
  ☐ Require review from Code Owners (optional)

☑ Require status checks to pass before merging
  ☑ Require branches to be up to date before merging
  
  Status checks found in the last week for this repository:
  ☑ test-summary
  ☑ Unit Tests
  ☑ Type Safety Check
  ☑ Lint Check
  ☑ Production Build

☑ Require conversation resolution before merging

☑ Require signed commits (optional)

☐ Require linear history (not recommended)

☑ Include administrators

☑ Restrict who can push to matching branches
  • No one (all changes via PRs)

☑ Do not allow force pushes

☑ Do not allow deletions
```

6. Click **Create** or **Save changes**

### Via GitHub CLI

```bash
# Set branch protection rules for main branch
gh api repos/{owner}/{repo}/branches/main/protection \
  --method PUT \
  -f required_status_checks='{"strict":true,"contexts":["test-summary","Unit Tests","Type Safety Check","Lint Check","Production Build"]}' \
  -f enforce_admins=true \
  -f required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  -f restrictions=null \
  -f allow_force_pushes=false \
  -f allow_deletions=false \
  -f required_conversation_resolution=true

# Example for NetNeural/MonoRepo repository:
gh api repos/NetNeural/MonoRepo/branches/main/protection \
  --method PUT \
  -f required_status_checks='{"strict":true,"contexts":["test-summary","Unit Tests","Type Safety Check","Lint Check","Production Build"]}' \
  -f enforce_admins=true \
  -f required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  -f restrictions=null \
  -f allow_force_pushes=false \
  -f allow_deletions=false \
  -f required_conversation_resolution=true
```

### Via Terraform (Infrastructure as Code)

```hcl
resource "github_branch_protection" "main" {
  repository_id = github_repository.repo.node_id
  pattern       = "main"

  required_status_checks {
    strict = true
    contexts = [
      "test-summary",
      "Unit Tests",
      "Type Safety Check",
      "Lint Check",
      "Production Build"
    ]
  }

  required_pull_request_reviews {
    dismiss_stale_reviews           = true
    required_approving_review_count = 1
  }

  enforce_admins              = true
  require_conversation_resolution = true
  allows_force_pushes        = false
  allows_deletions           = false
}
```

## Verification

After setting up branch protection rules:

1. **Test PR Flow**:
   ```bash
   git checkout -b test-branch-protection
   echo "test" > test-file.txt
   git add test-file.txt
   git commit -m "test: verify branch protection"
   git push origin test-branch-protection
   gh pr create --title "Test Branch Protection" --body "Testing branch protection rules"
   ```

2. **Verify Status Checks**:
   - Open the PR on GitHub
   - Confirm that all required status checks are listed
   - Confirm that "Merge" button is disabled until checks pass

3. **Verify Review Requirement**:
   - Confirm that PR requires 1 approval before merge
   - Test with a second account or ask a team member

4. **Test Direct Push (Should Fail)**:
   ```bash
   git checkout main
   echo "test" >> README.md
   git commit -am "test: direct push"
   git push origin main
   # Expected: remote: error: GH006: Protected branch update failed
   ```

## Development Workflow

With branch protection rules in place:

### Creating a Feature Branch
```bash
git checkout main
git pull origin main
git checkout -b feature/my-feature
# ... make changes ...
git add .
git commit -m "feat: implement my feature"
git push origin feature/my-feature
```

### Opening a Pull Request
```bash
gh pr create \
  --title "feat: implement my feature" \
  --body "Description of changes" \
  --assignee "@me" \
  --label "feature"
```

### Merging a Pull Request
1. Wait for all status checks to pass
2. Request review from team member
3. Address review comments
4. Get approval
5. Resolve all conversations
6. Merge via GitHub UI or:
   ```bash
   gh pr merge --auto --squash
   ```

## Emergency Hotfixes

For critical production issues, administrators can:

1. **Option 1**: Fast-track PR (still recommended)
   - Create hotfix branch
   - Open PR with high priority
   - Get immediate review
   - Merge once checks pass

2. **Option 2**: Bypass protection (use sparingly)
   - Temporarily disable "Include administrators" rule
   - Make direct commit
   - Re-enable rule immediately
   - Create post-merge PR for review

**⚠️ Important**: Document all protection bypasses in a security log.

## Monitoring & Alerts

Set up notifications for:

- Failed status checks on main branch
- Direct push attempts to protected branches
- Protection rule changes

Configure in GitHub: **Settings** → **Notifications** → **Actions**

## Troubleshooting

### Issue: Status checks not appearing
**Solution**: Ensure CI workflow has run at least once on the branch before adding to required checks.

### Issue: Can't merge even though checks pass
**Solution**: Ensure branch is up-to-date with main. Click "Update branch" on PR.

### Issue: Administrator can still push directly
**Solution**: Ensure "Include administrators" is checked in branch protection rules.

### Issue: Status check names don't match
**Solution**: Check exact job names in `.github/workflows/test.yml`. Status check names must match job names exactly.

## Best Practices

1. ✅ **Always use PRs**: Never commit directly to main, even as admin
2. ✅ **Keep branches short-lived**: Merge within 1-2 days to avoid conflicts
3. ✅ **Run tests locally first**: Use `npm test` before pushing
4. ✅ **Small, focused changes**: Easier to review and less likely to break
5. ✅ **Meaningful commit messages**: Follow conventional commits format
6. ✅ **Address review comments**: Don't ignore feedback
7. ✅ **Keep branch up-to-date**: Regularly merge main into feature branches

## Additional Resources

- [GitHub Branch Protection Documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)
- [GitHub Actions Status Checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/about-status-checks)
- [NetNeural CI/CD Test Automation](../development/docs/CI_CD.md)
- [NetNeural Contributing Guide](../CONTRIBUTING.md)

## Related Files

- `.github/workflows/test.yml` - Main CI/CD workflow with quality gates
- `.github/workflows/performance.yml` - Nightly performance testing
- `.github/dependabot.yml` - Automated dependency updates
- `development/package.json` - Test scripts and dependencies

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-13  
**Owner**: Platform Engineering Team  
**Status**: ✅ Ready for Implementation
