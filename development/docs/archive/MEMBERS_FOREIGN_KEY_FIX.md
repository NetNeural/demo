# Members Edge Function - Foreign Key Fix

## Issue

PostgreSQL error when querying organization_members with users join:

```
Could not embed because more than one relationship was found for 'organization_members' and 'users'
```

## Root Cause

The `organization_members` table has **two foreign keys** pointing to the `users` table:

1. `organization_members_user_id_fkey` - Links `organization_members.user_id` to `users.id` (the member)
2. `organization_members_invited_by_fkey` - Links `organization_members.invited_by` to `users.id` (who invited them)

When using `.select('users (...)')`, PostgreSQL doesn't know which relationship to use.

## Solution

Explicitly specify the foreign key relationship in all SELECT queries:

**Before (Ambiguous):**

```typescript
.select(`
  id,
  user_id,
  role,
  created_at,
  users (
    id,
    email,
    full_name
  )
`)
```

**After (Explicit):**

```typescript
.select(`
  id,
  user_id,
  role,
  created_at,
  users!organization_members_user_id_fkey (
    id,
    email,
    full_name
  )
`)
```

## Files Changed

- `supabase/functions/members/index.ts`
  - Fixed GET endpoint (list members)
  - Fixed POST endpoint (add member)
  - Fixed PATCH endpoint (update member role)

## Status

✅ **FIXED** - Edge function now loads without errors and can successfully query members with user details.

## Testing

Restart Next.js dev server and navigate to:

```
http://localhost:3000/dashboard/organizations → Members tab
```

Expected behavior:

- Members list loads with 4 members for NetNeural Demo organization
- Shows name, email, role, and join date
- Can add new members
- Can edit member roles
- Can remove members (except owners)
