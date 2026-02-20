# Complete Setup Guide - No More Hardcoded Values

This guide walks through setting up the NetNeural IoT Platform development environment with proper authentication and no hardcoded values.

## Quick Start

```bash
# 1. Reset database with seed data
npm run supabase:reset

# 2. Create test users in Supabase Auth
npm run setup:users

# 3. Start edge functions server
npm run supabase:functions:serve

# 4. Start development server (in new terminal)
npm run dev

# 5. Login at http://localhost:3000/auth/login
#    Email: admin@netneural.ai
#    Password: password123
```

## What This Sets Up

### Database

- ✅ 1 organization: "NetNeural Demo"
- ✅ 20 test devices (various types)
- ✅ 7 test alerts
- ✅ 2 locations
- ✅ 3 departments
- ✅ 1 device integration

### Users (in database)

- ✅ Admin User (org_owner)
- ✅ Regular User (user role)
- ✅ Viewer User (viewer role)

### Authentication (via setup:users script)

- ✅ Creates auth.users entries
- ✅ Links to database users
- ✅ Email confirmed
- ✅ Ready to login

## Detailed Steps

### Step 1: Database Setup

```bash
cd development
npm run supabase:reset
```

**What this does**:

- Drops all tables
- Runs migrations
- Loads seed data from `supabase/seed.sql`

**Output**:

```
Resetting local database...
Applying migrations...
Seeding data...
✓ Reset successful
```

**Verify**:

```bash
npm run supabase:studio
# Open http://localhost:54323
# Go to Table Editor → devices
# Should see 20 devices
```

### Step 2: Create Auth Users

```bash
npm run setup:users
```

**What this does**:

- Reads `.env.local` for Supabase credentials
- Uses service role key to create users
- Creates 3 test users in `auth.users`
- Sets user IDs to match seed data
- Confirms emails automatically

**Output**:

```
🚀 Creating test users...

✅ Created user: admin@netneural.ai
   ID: 00000000-0000-0000-0000-000000000001
   Role: org_owner
   Password: password123

✅ Created user: user@netneural.ai
   ID: 00000000-0000-0000-0000-000000000002
   Role: user
   Password: password123

✅ Created user: viewer@netneural.ai
   ID: 00000000-0000-0000-0000-000000000003
   Role: viewer
   Password: password123

✨ Done! Test users created.
```

**Verify**:

```bash
npm run supabase:studio
# Go to Authentication → Users
# Should see 3 users
```

### Step 3: Start Edge Functions

```bash
npm run supabase:functions:serve
```

**What this does**:

- Starts Deno runtime for edge functions
- Serves functions on port 54321
- Watches for code changes

**Output**:

```
Serving functions on http://127.0.0.1:54321/functions/v1/<function-name>
 - http://127.0.0.1:54321/functions/v1/devices
 - http://127.0.0.1:54321/functions/v1/alerts
 - http://127.0.0.1:54321/functions/v1/dashboard-stats
 - http://127.0.0.1:54321/functions/v1/organizations
 - http://127.0.0.1:54321/functions/v1/integrations
```

**Test manually**:

```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" \
  http://localhost:54321/functions/v1/devices?organization_id=00000000-0000-0000-0000-000000000001
```

Should return JSON with 20 devices.

### Step 4: Start Development Server

**Open a NEW terminal** (leave edge functions running):

```bash
cd development
npm run dev
```

**Output**:

```
  ▲ Next.js 15.x.x
  - Local:        http://localhost:3000
  - Ready in xxxx ms
```

### Step 5: Login and Test

1. **Navigate to**: http://localhost:3000
2. **Should redirect to**: http://localhost:3000/auth/login
3. **Login**:
   - Email: `admin@netneural.ai`
   - Password: `password123`
4. **Should redirect to**: http://localhost:3000/dashboard
5. **Verify**:
   - See 20 devices
   - See 7 alerts
   - See user email in sidebar: "admin@netneural.ai"
   - See organization name: "NetNeural Demo"

## How It Works (No Hardcoded Values)

### Before (Hardcoded)

```typescript
// ❌ BAD: Hardcoded everywhere
const mockUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'admin@netneural.ai',
}

const organizationId = '00000000-0000-0000-0000-000000000001'

fetch('/api/devices') // Returns ALL devices from ALL orgs
```

### After (Dynamic)

```typescript
// ✅ GOOD: From authentication
const { user } = useUser() // From Supabase Auth + Database

fetchEdgeFunction('devices', {
  organization_id: user.organizationId, // Dynamic from user's org
})

// Returns ONLY devices for user's organization
```

### Data Flow

```
1. User signs in
   ↓
2. UserProvider loads user from auth.users
   ↓
3. UserProvider fetches user profile from users table
   ↓
4. User profile includes organization_id
   ↓
5. Components use user.organizationId in API calls
   ↓
6. Edge functions filter by organization_id
   ↓
7. Database returns only that org's data
```

## File Structure

```
development/
├── src/
│   ├── lib/
│   │   └── auth.ts                    # ✅ User authentication utilities
│   ├── contexts/
│   │   └── UserContext.tsx            # ✅ User state management
│   ├── app/
│   │   ├── dashboard/
│   │   │   └── layout.tsx             # ✅ Uses UserProvider
│   │   └── auth/
│   │       └── login/
│   │           └── page.tsx           # Login page
│   └── components/
│       └── dashboard/
│           └── DeviceStatusCard.tsx   # ✅ Uses useUser()
├── supabase/
│   ├── seed.sql                       # ✅ Database seed data
│   ├── migrations/
│   │   └── *.sql                      # Database schema
│   └── functions/
│       ├── devices/                   # ✅ Filters by org_id
│       ├── alerts/                    # ✅ Filters by org_id
│       └── dashboard-stats/           # ✅ Filters by org_id
├── scripts/
│   └── create-test-users.js           # ✅ Creates auth users
├── .env.local                         # Environment variables
└── package.json                       # npm scripts
```

## Environment Variables

Required in `.env.local`:

```env
# Supabase (Local Development)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# These are default local Supabase keys - safe for development
```

## Testing Different Users

### Admin User (Full Access)

```
Email: admin@netneural.ai
Password: password123
Role: org_owner
```

### Regular User (Standard Access)

```
Email: user@netneural.ai
Password: password123
Role: user
```

### Viewer (Read-Only)

```
Email: viewer@netneural.ai
Password: password123
Role: viewer
```

To test:

1. Sign out
2. Sign in with different user
3. Should see same devices (same org)
4. Can implement role-based permissions later

## Troubleshooting

### Issue: "Cannot find user"

**Cause**: Auth user not created

**Solution**:

```bash
npm run setup:users
```

### Issue: "No devices returned"

**Cause**: Edge functions not running or organization_id mismatch

**Solution**:

```bash
# Check edge functions are running
curl -I http://localhost:54321/functions/v1/devices

# Restart edge functions
# Ctrl+C then:
npm run supabase:functions:serve
```

### Issue: "Redirecting to login"

**Cause**: User not authenticated

**Solution**:

1. Go to http://localhost:3000/auth/login
2. Sign in with `admin@netneural.ai` / `password123`

### Issue: "Organization not found"

**Cause**: Database not seeded

**Solution**:

```bash
npm run supabase:reset
npm run setup:users
```

### Issue: "Setup script fails"

**Cause**: Missing environment variables

**Solution**:
Check `.env.local` has:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Issue: "User IDs don't match"

**Cause**: Running `setup:users` before `supabase:reset`

**Solution**:

```bash
# Always run in this order:
npm run supabase:reset      # 1. Creates database users
npm run setup:users         # 2. Creates auth users with matching IDs
```

## Production Deployment

### Environment Variables

Production requires:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### User Creation

In production, users should:

1. Sign up via `/auth/signup`
2. Trigger creates entry in both `auth.users` and `users` tables
3. Assigned to organization automatically
4. Email verification enabled

### Organization Assignment

Add logic in signup flow:

```typescript
// After user signs up
const {
  data: { user },
} = await supabase.auth.signUp({
  email,
  password,
})

// Create users table entry
await supabase.from('users').insert({
  id: user.id,
  email: user.email,
  organization_id: defaultOrgId, // From invite link or default
  role: 'user',
})
```

## Next Steps

1. ✅ **Remove remaining hardcoded values**
   - Settings page
   - Other components

2. ✅ **Add role-based permissions**

   ```typescript
   if (user.role === 'org_owner') {
     // Can delete devices
   }
   ```

3. ✅ **Add organization management**
   - Create new organizations
   - Invite users
   - Switch between orgs

4. ✅ **Add multi-org support**
   - Users can belong to multiple orgs
   - Organization switcher in UI
   - Separate data per org

## Summary

✅ **No more hardcoded values!**

All user and organization data now comes from:

1. Supabase Auth (`auth.users`)
2. Database (`users`, `organizations` tables)
3. React Context (`UserContext`)
4. API calls (with `organization_id` parameter)

Everything is dynamic and multi-tenant ready! 🎉
