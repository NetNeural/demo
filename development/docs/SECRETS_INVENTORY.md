# Secrets Inventory & Management Guide
**Last Updated:** November 13, 2025  
**Status:** ✅ All production secrets secured in GitHub

---

## 📊 Overview

All production secrets are now managed via **GitHub Secrets** and accessible through GitHub Actions workflows. Local development uses `.env.local` (gitignored) with the same keys.

---

## 🔐 GitHub Secrets (Production)

### Supabase (Database & Backend)
| Secret Name | Purpose | Rotation | Last Updated |
|-------------|---------|----------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public API endpoint | 90 days | ~1 month ago |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (safe for client) | 90 days | ~1 month ago |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin access | **30 days** | ~3 months ago ⚠️ |
| `SUPABASE_ACCESS_TOKEN` | CLI authentication | 90 days | ~3 months ago |
| `SUPABASE_DB_PASSWORD` | Direct DB access | **30 days** | ~3 months ago ⚠️ |
| `SUPABASE_PROJECT_ID` | Project identifier | Static | ~3 months ago |
| `SUPABASE_ANON_KEY` | Legacy duplicate | N/A | ~3 months ago (consider removing) |
| `SUPABASE_URL` | Legacy duplicate | N/A | ~3 months ago (consider removing) |

**Action Items:**
- ⚠️ Rotate `SUPABASE_SERVICE_ROLE_KEY` (overdue by 60 days)
- ⚠️ Rotate `SUPABASE_DB_PASSWORD` (overdue by 60 days)
- 🧹 Consider removing duplicate `SUPABASE_ANON_KEY` and `SUPABASE_URL` (use `NEXT_PUBLIC_*` versions)

---

### Sentry (Error Tracking & Monitoring)
| Secret Name | Purpose | Rotation | Last Updated |
|-------------|---------|----------|--------------|
| `NEXT_PUBLIC_SENTRY_DSN` | Public error reporting endpoint | 180 days | ~8 days ago ✅ |
| `SENTRY_ORG` | Organization ID | Static | ~8 days ago ✅ |
| `SENTRY_PROJECT` | Project ID | Static | ~8 days ago ✅ |
| `SENTRY_AUTH_TOKEN` | Release/deploy authentication | **90 days** | ~8 days ago ✅ |
| `SENTRY_OTLP_ENDPOINT` | OpenTelemetry logs endpoint | 180 days | ~8 days ago ✅ |

**Status:** ✅ All Sentry secrets current and properly secured

---

### Golioth (IoT Device Management)
| Secret Name | Purpose | Rotation | Last Updated |
|-------------|---------|----------|--------------|
| `GOLIOTH_API_KEY` | API authentication | **90 days** | Today ✅ |

**Status:** ✅ Newly added, fresh rotation

**Usage:**
- Used in Edge Functions for device data fetching
- Used in local exploration scripts (`explore_golioth_api.js`, `explore_golioth_device.js`)

---

### GitHub (CI/CD & Automation)
| Secret Name | Purpose | Rotation | Last Updated |
|-------------|---------|----------|--------------|
| `GITHUB_TOKEN` | Personal access token | **90 days** | Today ✅ |

**Status:** ✅ Newly secured (was previously only in `.env.local`)

---

## 🏠 Local Development (`.env.local`)

**Location:** `development/.env.local` (gitignored)

### Current Configuration:
```bash
# Supabase Local (Demo Keys - Safe)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Golioth (Production Key - for testing)
GOLIOTH_API_KEY=<from GitHub secrets>

# GitHub (Personal Token - for local scripts)
GITHUB_TOKEN=<from GitHub secrets>

# Sentry (Production Values - for testing)
NEXT_PUBLIC_SENTRY_DSN=<from GitHub secrets>
SENTRY_ORG=<from GitHub secrets>
SENTRY_PROJECT=<from GitHub secrets>
SENTRY_AUTH_TOKEN=<from GitHub secrets>

# SMTP (Local Mailpit)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=testuser
SMTP_PASS=testpass

# Development Secrets (Placeholders)
JWT_SECRET=your-jwt-secret-min-32-chars-for-local-dev-only
ENCRYPTION_KEY=your-encryption-key-32-chars-for-local-dev
```

---

## 🔄 Rotation Schedule

| Tier | Rotation Interval | Secrets |
|------|-------------------|---------|
| **Tier 0** (Public) | No rotation needed | `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **Tier 1** (Platform Admin) | **30 days** | `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD` |
| **Tier 2** (External APIs) | **90 days** | `GOLIOTH_API_KEY`, `GITHUB_TOKEN`, `SENTRY_AUTH_TOKEN`, `SUPABASE_ACCESS_TOKEN` |
| **Tier 3** (Cryptographic) | **90 days** | `JWT_SECRET`, `ENCRYPTION_KEY` |

---

## 🚨 Immediate Actions Required

### High Priority (This Week)
1. **Rotate Overdue Secrets** (3 months old):
   - `SUPABASE_SERVICE_ROLE_KEY` → Get new key from Supabase Dashboard
   - `SUPABASE_DB_PASSWORD` → Reset via Supabase CLI or Dashboard
   - Update in GitHub secrets: `gh secret set <KEY> --repo NetNeural/MonoRepo`

2. **Clean Up Duplicates:**
   - Remove `SUPABASE_ANON_KEY` (use `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead)
   - Remove `SUPABASE_URL` (use `NEXT_PUBLIC_SUPABASE_URL` instead)
   - Command: `gh secret delete <KEY> --repo NetNeural/MonoRepo`

### Medium Priority (This Month)
3. **Audit All Sentry Configuration:**
   - Verify OTLP endpoint is actually used (or remove)
   - Confirm all error tracking works in production

4. **Document Rotation Process:**
   - Add rotation commands to this file
   - Set calendar reminders for 30/90 day intervals

---

## 📝 Rotation Commands

### Update GitHub Secret
```bash
# Interactive (secure)
gh secret set SECRET_NAME --repo NetNeural/MonoRepo

# From file
echo "new-secret-value" | gh secret set SECRET_NAME --repo NetNeural/MonoRepo
```

### Update Supabase Secret (for Edge Functions)
```bash
cd development
supabase secrets set SECRET_NAME=value
supabase functions deploy <function-name>
```

### Bulk Update from .env file
```bash
gh secret set -f .env.production --repo NetNeural/MonoRepo
```

---

## ✅ Recent Changes (November 13, 2025)

### Completed
- ✅ Added `GOLIOTH_API_KEY` to GitHub secrets
- ✅ Added `GITHUB_TOKEN` to GitHub secrets
- ✅ Removed hardcoded secrets from `explore_golioth_api.js`
- ✅ Removed hardcoded secrets from `explore_golioth_device.js`
- ✅ Updated `.env.local` with production guidance comments
- ✅ Created comprehensive secrets inventory (this document)

### Code Changes
**Files Modified:**
1. `development/explore_golioth_api.js` - Now uses `process.env.GOLIOTH_API_KEY`
2. `development/explore_golioth_device.js` - Now uses `process.env.GOLIOTH_API_KEY`
3. `development/.env.local` - Added comments indicating GitHub secret sources

---

## 🔍 Verification

### Check GitHub Secrets
```bash
gh secret list --repo NetNeural/MonoRepo
```

### Check Supabase Secrets (Edge Functions)
```bash
cd development
supabase secrets list
```

### Verify Local Setup
```bash
# Test Golioth API access
cd development
node explore_golioth_api.js

# Should see: ✅ Connecting with credentials from environment
# Should NOT see: Hardcoded API key
```

---

## 📚 Related Documentation
- [SECRETS_GOVERNANCE.md](./SECRETS_GOVERNANCE.md) - 4-tier classification system
- [SUPABASE_GITHUB_SECRETS_STRATEGY.md](./SUPABASE_GITHUB_SECRETS_STRATEGY.md) - Official best practices
- [.env.example](../.env.example) - Template for new developers
- [GitHub Actions Workflows](../.github/workflows/) - Where secrets are consumed

---

## 🔐 Security Notes

1. **Never commit `.env.local`** - It's in `.gitignore` for a reason
2. **Rotate on compromise** - If any secret is exposed, rotate immediately
3. **Use GitHub Secrets for CI/CD** - Never hardcode in workflow files
4. **Principle of Least Privilege** - Use anon keys in client code, service role only server-side
5. **Audit regularly** - Review this inventory monthly

---

**Next Review Date:** December 13, 2025 (30 days)
