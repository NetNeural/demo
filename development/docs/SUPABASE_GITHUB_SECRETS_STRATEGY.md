# Supabase + GitHub Best Practice: Official Secrets Strategy

## Executive Summary
**You already pay for both services** → Use their native integrations, avoid third-party vaults.

**Recommended Architecture:**
- **Supabase Vault** (database-level encrypted secrets) → Runtime secrets for Edge Functions, Database Functions, Triggers
- **GitHub Actions Secrets** → Build-time secrets for CI/CD, static export generation
- **Supabase CLI Secrets** (`supabase secrets set`) → Edge Function environment variables
- **Local Development** → `.env.local` with placeholders + selective Vault queries for testing

---

## What is Supabase Vault?

**Official Feature:** Postgres extension (`pgsql-vault`) for encrypted secret storage **inside your database**.

**Key Benefits:**
- ✅ Authenticated encryption (libsodium-based AEAD)
- ✅ Secrets encrypted at rest, in backups, in replication streams
- ✅ Encryption key **never stored in database** (Supabase manages it separately)
- ✅ Query secrets via SQL: `SELECT * FROM vault.decrypted_secrets`
- ✅ Use in Database Functions, Triggers, Webhooks without exposing to client
- ✅ No additional service or cost (included in Supabase Pro+)

**Example:**
```sql
-- Store secret
SELECT vault.create_secret('sk_live_golioth_key', 'golioth_api', 'Production Golioth API key');

-- Retrieve in function
CREATE OR REPLACE FUNCTION call_golioth_api()
RETURNS json AS $$
DECLARE
  api_key text;
BEGIN
  SELECT decrypted_secret INTO api_key 
  FROM vault.decrypted_secrets 
  WHERE name = 'golioth_api';
  
  -- Use api_key in http request via pg_net or http extension
  RETURN ...;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Recommended Two-Platform Strategy

### 1. GitHub Actions Secrets
**Purpose:** Build-time environment variables for Next.js static export

**Store Here:**
- `NEXT_PUBLIC_SUPABASE_URL` (public, but centralized)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public, RLS-protected)
- `SUPABASE_ACCESS_TOKEN` (CLI authentication)
- `SUPABASE_PROJECT_REF` (project identifier)

**Workflow Pattern:**
```yaml
# .github/workflows/deploy.yml
env:
  NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
run: npm run build
```

### 2. Supabase CLI Secrets (Edge Functions)
**Purpose:** Runtime environment for Deno Edge Functions

**Store Here:**
- `GOLIOTH_API_KEY` (external API)
- `STRIPE_SECRET_KEY` (payment processing)
- `JWT_SECRET` (if not using Supabase Auth's built-in)
- Any third-party service credentials

**Management:**
```bash
# Production
supabase secrets set GOLIOTH_API_KEY=actual_key_here
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx

# Verify
supabase secrets list

# Use in Edge Function
const apiKey = Deno.env.get('GOLIOTH_API_KEY');
```

### 3. Supabase Vault (Database Secrets)
**Purpose:** Secrets used by Postgres Functions, Triggers, pg_cron jobs

**Store Here:**
- API keys for `pg_net` async HTTP calls
- Webhook signing secrets
- Database-triggered integrations (Stripe webhooks, Golioth device sync)
- Credentials for Foreign Data Wrappers (if connecting to external DBs)

**Management:**
```sql
-- Via Dashboard UI: Database → Vault → Add Secret
-- Or via SQL:
SELECT vault.create_secret('webhook_secret', 'stripe_webhook', 'whsec_xxx');

-- Use in trigger:
CREATE OR REPLACE FUNCTION process_webhook()
RETURNS trigger AS $$
DECLARE
  secret text;
BEGIN
  SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name = 'stripe_webhook';
  -- Verify signature with secret
  ...
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Decision Matrix: Where Does Each Secret Go?

| Secret Type | Example | GitHub Secrets | CLI Secrets | Vault | Local .env |
|-------------|---------|----------------|-------------|-------|------------|
| Public client keys | NEXT_PUBLIC_SUPABASE_ANON_KEY | ✅ Build | ❌ | ❌ | ✅ |
| Edge Function runtime | GOLIOTH_API_KEY | ❌ | ✅ Production | ❌ | ✅ |
| Database function secrets | Webhook signing key | ❌ | ❌ | ✅ | ❌ (query Vault) |
| CI/CD tokens | SUPABASE_ACCESS_TOKEN | ✅ | ❌ | ❌ | ✅ (personal) |
| Build-time config | API base URLs | ✅ | ❌ | ❌ | ✅ |

---

## Local Development Workflow

### Option A: Placeholder Mode (Recommended for Solo Dev)
```bash
# development/.env.local
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=local-placeholder
GOLIOTH_API_KEY=dev-placeholder-or-test-key

# Start local stack
npm run dev:full:debug
```

### Option B: Vault Query Mode (For Testing Production Integrations)
```sql
-- Grant your local user access
GRANT USAGE ON SCHEMA vault TO your_dev_role;
GRANT SELECT ON vault.decrypted_secrets TO your_dev_role;

-- Query in local script
const { data } = await supabase
  .from('vault.decrypted_secrets')
  .select('decrypted_secret')
  .eq('name', 'golioth_api')
  .single();
```

### Option C: CLI Secrets for Local Functions
```bash
# supabase/functions/.env (gitignored)
GOLIOTH_API_KEY=test-key-here

# Serve with env file
supabase functions serve --env-file supabase/functions/.env
```

---

## Migration Plan (Supabase + GitHub Only)

### Phase 1: Inventory & Classify
- [x] Audit existing secrets (already done)
- [ ] Classify by lifecycle (build vs runtime vs database)
- [ ] Document ownership (you, CI system, database role)

### Phase 2: Populate GitHub Secrets
```bash
# Via GitHub CLI
gh secret set NEXT_PUBLIC_SUPABASE_URL --body "https://xxx.supabase.co"
gh secret set NEXT_PUBLIC_SUPABASE_ANON_KEY --body "eyJ..."
gh secret set SUPABASE_ACCESS_TOKEN --body "sbp_..."
```

### Phase 3: Populate CLI Secrets (Edge Functions)
```bash
cd development
supabase link --project-ref your-project-ref
supabase secrets set GOLIOTH_API_KEY=actual-key
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
```

### Phase 4: Populate Vault (Database Secrets)
```sql
-- Via Supabase Dashboard > Database > Vault
-- Or via SQL Editor:
SELECT vault.create_secret('webhook_secret', 'stripe_webhook', 'whsec_xxx');
SELECT vault.create_secret('golioth_db_key', 'golioth_trigger', 'api-key-for-pg-net');
```

### Phase 5: Refactor Hardcoded Values
```typescript
// Before (hardcoded in development/explore_golioth_api.js)
const GOLIOTH_API_KEY = '<your-golioth-api-key>';

// After
const GOLIOTH_API_KEY = process.env.GOLIOTH_API_KEY;
if (!GOLIOTH_API_KEY) throw new Error('GOLIOTH_API_KEY not set');
```

### Phase 6: Add Presence Diagnostics
```typescript
// app/api/diag/secrets/route.ts (protected by auth)
export async function GET(request: Request) {
  const required = ['GOLIOTH_API_KEY', 'STRIPE_SECRET_KEY'];
  const status = required.map(key => ({
    name: key,
    present: !!process.env[key],
    length: process.env[key]?.length || 0 // Don't expose value
  }));
  return Response.json({ status });
}
```

---

## Security Best Practices

### Access Control
```sql
-- Restrict Vault access to specific roles
REVOKE ALL ON vault.decrypted_secrets FROM PUBLIC;
GRANT SELECT ON vault.decrypted_secrets TO authenticated; -- Only logged-in users
-- Or even stricter:
GRANT SELECT ON vault.decrypted_secrets TO service_role; -- Only service role
```

### Rotation Workflow
```bash
# 1. Generate new secret
NEW_KEY=$(openssl rand -hex 32)

# 2. Update in Supabase CLI
supabase secrets set JWT_SECRET=$NEW_KEY

# 3. Update in GitHub
gh secret set JWT_SECRET --body "$NEW_KEY"

# 4. Update in Vault (if used)
UPDATE vault.secrets 
SET secret = vault.create_secret($NEW_KEY, 'jwt_main', 'Rotated 2025-11-13')
WHERE name = 'jwt_main';

# 5. Redeploy
git commit -m "Rotate JWT secret" --allow-empty
git push
```

### Audit Logging
```sql
-- Track secret access (custom audit table)
CREATE TABLE secret_access_log (
  id bigserial PRIMARY KEY,
  secret_name text,
  accessed_by text,
  accessed_at timestamptz DEFAULT now()
);

-- Log in function
CREATE OR REPLACE FUNCTION get_secret_with_audit(secret_name text)
RETURNS text AS $$
DECLARE
  result text;
BEGIN
  SELECT decrypted_secret INTO result 
  FROM vault.decrypted_secrets 
  WHERE name = secret_name;
  
  INSERT INTO secret_access_log (secret_name, accessed_by)
  VALUES (secret_name, current_user);
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Cost Analysis

**Current:** $0 extra (included in existing subscriptions)
- Supabase Pro: ~$25/month (already paying) → Vault included
- GitHub Free/Team: (already paying) → Secrets included

**Alternative (External Vault):**
- Doppler: $40+/month
- Infisical Cloud: $21+/month
- HashiCorp Vault: $100+/month (HCP) or ops overhead (self-hosted)

**Recommendation:** Start with native features. Only add external vault if:
- Team grows >5 developers (centralized policy management)
- Compliance requires it (SOC2, HIPAA with specific audit requirements)
- Need dynamic database credentials (short-lived tokens)

---

## Action Items (In Order)

1. ✅ Sanitize `.env.example` (already done)
2. ⏳ Create inventory spreadsheet (classify secrets by storage type)
3. ⏳ Populate GitHub Secrets (build-time only)
4. ⏳ Populate Supabase CLI Secrets (runtime Edge Functions)
5. ⏳ Evaluate which secrets belong in Vault (database functions)
6. ⏳ Refactor hardcoded key in `development/explore_golioth_api.js`
7. ⏳ Add diagnostic endpoint (`/api/diag/secrets`)
8. ⏳ Document rotation playbook (quarterly calendar)
9. ⏳ Add pre-commit hook (warn on secret patterns)

---

## References

- [Supabase Vault Official Docs](https://supabase.com/docs/guides/database/vault)
- [Supabase CLI Secrets](https://supabase.com/docs/guides/functions/secrets)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions)
- [Managing Environments (Supabase)](https://supabase.com/docs/guides/cli/managing-environments)

---

**Next Steps:** Approve this strategy, then I'll create the inventory template and refactor the first hardcoded secret.
