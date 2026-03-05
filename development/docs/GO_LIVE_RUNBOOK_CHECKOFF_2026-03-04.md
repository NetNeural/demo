# Go-Live Runbook Checkoff — First Pass
Date: 2026-03-04
Source: /dashboard/support/?tab=go-live-runbook

## Summary
- Checked in this pass: 7 items
- Verified PASS: 3
- Verified FAIL: 3
- Blocked (environment/network): 1

## Results by Runbook Step ID

### PASS
1. `env-prod-secrets`
   - Evidence: `gh secret list --repo NetNeural/MonoRepo` returned PROD_* keys present.

2. `build-lint`
   - Evidence: `npm run lint` completed with `0 errors` and warnings only (`✖ 555 problems (0 errors, 555 warnings)`).

3. `sec-csp`
   - Evidence: `next.config.js` includes `Content-Security-Policy` in headers config.

### FAIL
1. `build-passes`
   - Evidence: `npm run build` failed with webpack module-not-found errors:
     - `react-markdown`
     - `bad-words`

2. `sec-cors`
   - Evidence: multiple Edge Functions set `Access-Control-Allow-Origin: '*'` (not limited to production domain).

3. `dns-verify`
   - Evidence: `curl.exe -I https://sentinel.netneural.ai` failed TLS revocation check from this machine (`CRYPT_E_NO_REVOCATION_CHECK`).

### BLOCKED / NOT VERIFIABLE FROM CURRENT HOST
1. `dns-cname`
   - Evidence: `nslookup sentinel.netneural.ai` timed out due local DNS resolver/network path.

## Not Yet Checked (Next Pass)
- `db-migrations`
- `db-rls`
- `db-indexes`
- `db-backups`
- `env-no-staging-keys`
- `env-golioth`
- `build-size`
- `sec-audit-complete`
- full smoke test section
- post-launch checks
- rollback readiness checks

## Quick UI Checkoff (for verified PASS items)
The runbook persists checkboxes in `localStorage` key `go_live_runbook_v1`.
Run this in browser devtools console on the runbook page to mark verified PASS items:

```js
const passIds = ['env-prod-secrets', 'build-lint', 'sec-csp'];
const key = 'go_live_runbook_v1';
const current = JSON.parse(localStorage.getItem(key) || '[]');
const merged = [...new Set([...current, ...passIds])];
localStorage.setItem(key, JSON.stringify(merged));
location.reload();
```

## Immediate Fix List to Unblock Critical Checks
1. Install missing build dependencies used by app code:
   - `react-markdown`
   - `bad-words`
2. Restrict Edge Function CORS from `*` to approved prod origins.
3. Re-run DNS/HTTPS checks from a network path with working DNS and certificate revocation access.
