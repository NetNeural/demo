# NetNeural Secrets Governance & Migration Plan

## Objectives
- Eliminate committed secrets (service_role, API keys, JWTs)
- Provide reliable local development without risking production keys
- Enable production debugging with traceability of which secret source is used
- Preserve all existing data (no destructive DB operations) during migration

## Secret Classes
| Class | Example | Exposure Allowed? | Storage | Rotation |
|-------|---------|------------------|---------|----------|
| Public Client | NEXT_PUBLIC_SUPABASE_ANON_KEY | Yes (RLS-protected) | GitHub Actions / .env.local | Rare (only on compromise) |
| Privileged Backend | SUPABASE_SERVICE_ROLE_KEY | No | Supabase secrets / GitHub Actions | Quarterly |
| Third-party API | GOLIOTH_API_KEY, STRIPE_SECRET_KEY | No | Supabase secrets (runtime) | Provider policy |
| Operational Access | SUPABASE_ACCESS_TOKEN | No | GitHub Actions (workflow only) | Quarterly |
| Cryptographic | JWT_SECRET, ENCRYPTION_KEY | No | GitHub Actions / Vault | Semi-annual |

## Source of Truth Strategy
| Environment | Build-Time Source | Runtime Source (Edge Functions) | Local Sync |
|-------------|-------------------|----------------------------------|-----------|
| Local Dev | `.env.local` (gitignored) | `supabase/functions/.env` | `sync-secrets-local.sh` |
| Staging | GitHub Secrets | Supabase Secrets | `supabase secrets list` export |
| Production | GitHub Secrets | Supabase Secrets | Read-only (no bulk pull) |

## Recommended Variables
```
# Build / Client
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY

# Server / Edge Functions
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ACCESS_TOKEN
GOLIOTH_API_KEY
STRIPE_SECRET_KEY
JWT_SECRET
ENCRYPTION_KEY
```

## Migration Steps (Non-Destructive)
1. Inventory committed secrets (DONE via automated grep).
2. Sanitize `.env.example` (DONE).
3. Create missing GitHub Actions secrets for all values currently used.
4. Push sensitive function secrets to Supabase:
   ```bash
   # From a prepared file (secrets.env)
   supabase secrets set --env-file secrets.env
   supabase secrets list
   ```
5. Replace any hardcoded values in code with `process.env.*` or `Deno.env.get()`.
6. Add CI check: fail build if placeholders detected in production deploy.
7. Long-term: introduce secret rotation script.

## Local Development Flow
```
cp development/.env.example development/.env.local
# Fill in local values (anon key safe; service_role limited use) 
# Start stack
npm run dev:full:debug
```
Edge Functions local:
```
# supabase/functions/.env (gitignored)
GOLIOTH_API_KEY=dev-golioth
STRIPE_SECRET_KEY=sk_test_xxx
supabase functions serve --env-file supabase/functions/.env
```

## Production Deployment Flow
1. Secrets added to GitHub (Settings → Secrets):
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - GOLIOTH_API_KEY
   - STRIPE_SECRET_KEY
   - JWT_SECRET
2. Workflow exports them to build & static export.
3. Edge Function runtime uses Supabase Secrets (CLI or Dashboard).

## Visibility & Debugging
Add a diagnostic endpoint (protected) to enumerate which expected env vars are present (without values) for debugging missing configuration.

## Rotation Playbook (Example)
```bash
# 1. Generate new key
openssl rand -hex 32 > new_jwt_secret.txt
# 2. Update GitHub Secret
gh secret set JWT_SECRET < new_jwt_secret.txt
# 3. Update Supabase runtime secret
supabase secrets set JWT_SECRET=$(cat new_jwt_secret.txt)
# 4. Redeploy (static export) + invalidate caches
npm run build && npm run export
```

## Security Checklist
- [ ] No hardcoded secrets in repo search
- [ ] `.env.local` in `.gitignore`
- [ ] Supabase service_role never sent to client
- [ ] Diagnostic endpoint returns OK
- [ ] Secrets rotation documented
- [ ] GitHub workflow masks values (truncate echo)

## Next Enhancements
- Add automated scanner in CI (regex for typical secret formats)
- Add OpenID Connect for cloud provider tokens (reduce stored secrets)
- Optional: integrate with external vault if scaling team

---
Document version: 2025-11-13
