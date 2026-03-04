## Bug

**Endpoint:** `GET /functions/v1/request-access?view=sent` and `?view=received`
**Error:** HTTP 500 on all GET requests to the Access Requests page

## Root Cause

The GET handler used PostgREST FK-based join syntax:
```
requester:users!access_requests_requester_id_fkey(id, full_name, email)
```

PostgREST resolves these joins from its in-memory schema cache. After the RLS enforcement migration (`20260306000000_enforce_org_scoped_rls.sql`) and other schema reloads, the cache failed to resolve the constraint names — causing a 500 on every GET request regardless of auth state.

This is a known PostgREST behavior: cache reloads can leave relationship metadata unresolved until the next full restart, even after `NOTIFY pgrst, 'reload schema'`.

## Fix (commit `8836de6`)

Replaced all 5 FK-based joins in the GET handler with two explicit parallel batch queries:
- `access_requests` queried bare (`SELECT *`) — no joins, no cache dependency
- `users` batch-fetched by ID set for requester / approver / denier
- `organizations` batch-fetched by ID set for requester_org / target_org
- Results merged in TypeScript — identical response shape, no frontend changes

## Environments Fixed

- ✅ staging (`atgbmxicqikmapfqouco`) — deployed directly
- ✅ dev (`tsomafkalaoarnuwgdyu`) — deployed directly
- ✅ prod (`bldojxpockljyivldxwf`) — deployed directly

## Files Changed

- `development/supabase/functions/request-access/index.ts`
- `development/supabase/migrations/20260303230000_fix_access_requests_fk_v2.sql`
