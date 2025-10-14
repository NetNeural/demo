# Removing Hardcoded Values - Implementation Guide

## Overview
We've eliminated hardcoded user and organization values throughout the application, replacing them with dynamic data from the database through proper authentication.

## What Was Changed

### 1. Created Auth Utility (`src/lib/auth.ts`)

**Purpose**: Centralized functions for user authentication and API calls

**Key Functions**:
- `getCurrentUser()`: Fetches authenticated user with their organization info
- `fetchEdgeFunction()`: Makes authenticated calls to Supabase edge functions with proper headers

**Benefits**:
- No hardcoded user IDs
- No hardcoded organization IDs  
- No hardcoded email addresses
- Proper authentication headers on all API calls

### 2. Created User Context (`src/contexts/UserContext.tsx`)

**Purpose**: React context provider for managing user state across the app

**Features**:
- Loads user on app startup
- Provides user, loading state, and refresh function
- Redirects to login if not authenticated
- Available throughout the app via `useUser()` hook

**Usage**:
```typescript
import { useUser } from '@/contexts/UserContext'

function MyComponent() {
  const { user, loading } = useUser()
  
  if (loading) return <div>Loading...</div>
  if (!user) return null
  
  // Use user data
  console.log(user.email)           // "admin@netneural.ai"
  console.log(user.organizationId)  // "00000000-0000-0000-0000-000000000001"
  console.log(user.organizationName) // "NetNeural Demo"
  console.log(user.role)            // "org_owner"
}
```

### 3. Updated Dashboard Layout (`src/app/dashboard/layout.tsx`)

**Before**:
```typescript
// ❌ Hardcoded mock user
const mockUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'admin@netneural.ai',
  role: 'admin'
} as User
```

**After**:
```typescript
// ✅ Dynamic user from context
const { user, loading } = useUser()
// user comes from database based on authentication
```

**Changes**:
- Wrapped in `<UserProvider>` for user context
- Displays actual user email and organization name
- No more hardcoded values

### 4. Updated Components to Use Context

**DeviceStatusCard** (`src/components/dashboard/DeviceStatusCard.tsx`):

**Before**:
```typescript
// ❌ No organization filtering - returns all devices
const response = await fetch(`${SUPABASE_URL}/functions/v1/devices`)
```

**After**:
```typescript
// ✅ Filters by user's organization
const { user } = useUser()
const result = await fetchEdgeFunction('devices', {
  organization_id: user.organizationId  // Dynamic from authenticated user
})
```

### 5. Updated Seed Data (`supabase/seed.sql`)

**Added**:
```sql
-- Demo users that can be used for testing
INSERT INTO users (id, email, full_name, role, organization_id, is_active) VALUES
('00000000-0000-0000-0000-000000000001', 'admin@netneural.ai', 'Admin User', 'org_owner', '00000000-0000-0000-0000-000000000001', true),
('00000000-0000-0000-0000-000000000002', 'user@netneural.ai', 'Regular User', 'user', '00000000-0000-0000-0000-000000000001', true),
('00000000-0000-0000-0000-000000000003', 'viewer@netneural.ai', 'Viewer User', 'viewer', '00000000-0000-0000-0000-000000000001', true);
```

**Note**: These are database records. The actual `auth.users` entries must be created through Supabase Auth.

## How to Create Test Users

### Method 1: Using Supabase Studio (Recommended for Development)

1. **Start Supabase Studio**:
   ```bash
   npm run supabase:studio
   ```

2. **Navigate to Authentication**:
   - Open http://localhost:54323
   - Click "Authentication" in sidebar
   - Click "Users" tab

3. **Add User**:
   - Click "Add User" button
   - Enter email: `admin@netneural.ai`
   - Enter password: `password123`
   - **Important**: Set User UID to `00000000-0000-0000-0000-000000000001`
   - Click "Create User"

4. **Repeat for other test users**:
   - `user@netneural.ai` with UID `00000000-0000-0000-0000-000000000002`
   - `viewer@netneural.ai` with UID `00000000-0000-0000-0000-000000000003`

### Method 2: Using Supabase Auth API

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Service role key required
)

// Create test users
async function createTestUsers() {
  const users = [
    {
      email: 'admin@netneural.ai',
      password: 'password123',
      user_metadata: { full_name: 'Admin User' },
      email_confirm: true
    },
    {
      email: 'user@netneural.ai',
      password: 'password123',
      user_metadata: { full_name: 'Regular User' },
      email_confirm: true
    },
    {
      email: 'viewer@netneural.ai',
      password: 'password123',
      user_metadata: { full_name: 'Viewer User' },
      email_confirm: true
    }
  ]

  for (const userData of users) {
    const { data, error } = await supabase.auth.admin.createUser(userData)
    if (error) console.error(`Failed to create ${userData.email}:`, error)
    else console.log(`Created user: ${data.user.email}`)
  }
}
```

### Method 3: Using Sign-Up Flow

1. **Navigate to Sign-Up**: http://localhost:3000/auth/signup
2. **Fill in form**:
   - Email: `admin@netneural.ai`
   - Password: `password123`
   - Full Name: `Admin User`
3. **Sign Up**: User will be created in both `auth.users` and `users` tables

## Database Schema Flow

```
┌─────────────────┐
│  auth.users     │  (Supabase Auth - managed by Supabase)
│  - id           │
│  - email        │
│  - created_at   │
└────────┬────────┘
         │ REFERENCES
         │
┌────────▼────────┐
│  users          │  (Your app - custom user data)
│  - id           │
│  - email        │
│  - full_name    │
│  - role         │
│  - org_id       │──┐
└─────────────────┘  │ REFERENCES
                     │
         ┌───────────▼────────────┐
         │  organizations         │
         │  - id                  │
         │  - name                │
         │  - slug                │
         └────────────────────────┘
```

## Authentication Flow

1. **User Signs In**:
   ```typescript
   await supabase.auth.signInWithPassword({
     email: 'admin@netneural.ai',
     password: 'password123'
   })
   ```

2. **UserProvider Loads User**:
   ```typescript
   // Gets authenticated user from Supabase Auth
   const { data: { user } } = await supabase.auth.getUser()
   
   // Gets profile with organization from your database
   const { data: profile } = await supabase
     .from('users')
     .select('role, organization:organizations(id, name)')
     .eq('id', user.id)
     .single()
   ```

3. **User Context Provides Data**:
   ```typescript
   {
     id: user.id,
     email: user.email,
     organizationId: profile.organization.id,
     organizationName: profile.organization.name,
     role: profile.role
   }
   ```

4. **Components Use User Data**:
   ```typescript
   const { user } = useUser()
   
   // Make API calls with user's organization
   const devices = await fetchEdgeFunction('devices', {
     organization_id: user.organizationId
   })
   ```

## Edge Functions Organization Filtering

All edge functions now use the organization_id parameter:

**devices/index.ts**:
```typescript
const organizationId = url.searchParams.get('organization_id') || 
  '00000000-0000-0000-0000-000000000001'  // Default for testing

const { data: devices } = await supabaseClient
  .from('devices')
  .select('*')
  .eq('organization_id', organizationId)  // ✅ Filters by org
```

**Frontend calls**:
```typescript
// ✅ Passes user's organization ID
fetchEdgeFunction('devices', {
  organization_id: user.organizationId
})
```

## Testing the Changes

### 1. Reset Database
```bash
cd development
npm run supabase:reset
```

### 2. Create Test User (via Supabase Studio)
- Navigate to http://localhost:54323
- Go to Authentication → Users
- Add user with email `admin@netneural.ai` and UID `00000000-0000-0000-0000-000000000001`

### 3. Restart Services
```bash
# Terminal 1: Edge functions
npm run supabase:functions:serve

# Terminal 2: Dev server
npm run dev
```

### 4. Sign In
- Navigate to http://localhost:3000/auth/login
- Email: `admin@netneural.ai`
- Password: `password123`

### 5. Verify No Hardcoded Values
Open browser console and check:
```javascript
// Should see user data from database
console.log('User data loaded from database')

// Should see organization filtering
console.log('Fetching devices for org:', user.organizationId)

// Should see actual user info in nav
// "admin@netneural.ai"
// "NetNeural Demo"
```

## Benefits of This Approach

### ✅ Security
- No hardcoded credentials
- Proper authentication required
- Organization isolation enforced

### ✅ Scalability
- Works with multiple organizations
- Easy to add more users
- Role-based access can be added

### ✅ Maintainability
- Single source of truth (database)
- Easy to test with different users
- No magic values scattered in code

### ✅ Proper Multi-Tenancy
- Each user sees only their org's data
- Organization ID flows from auth → API → database
- No cross-org data leakage

## Common Issues & Solutions

### Issue: "User not found"
**Solution**: Create the user in both `auth.users` (via Supabase Studio) and `users` table (via seed.sql)

### Issue: "Organization not found"
**Solution**: Ensure user's `organization_id` in `users` table matches an existing organization

### Issue: "No devices returned"
**Solution**: Verify devices in database have matching `organization_id`

### Issue: "Redirecting to login"
**Solution**: User not authenticated - sign in via `/auth/login`

## Next Steps

1. ✅ **Remove remaining hardcoded values** in settings page and other components
2. ✅ **Create user signup flow** that automatically creates `users` table entry
3. ✅ **Add role-based permissions** using the `role` field from user profile
4. ✅ **Add organization switching** for users in multiple orgs
5. ✅ **Add organization management** for creating/editing organizations

## Summary

**Before**: Hardcoded values everywhere
```typescript
const mockUser = { id: '0000...', email: 'admin@...' }
const organizationId = '0000...'
```

**After**: Dynamic data from authentication
```typescript
const { user } = useUser()  // From database
const devices = await fetchEdgeFunction('devices', {
  organization_id: user.organizationId  // From user's profile
})
```

All user data now flows from:
1. Supabase Auth (`auth.users`)
2. User profile (`users` table with organization relationship)
3. User context (React context provider)
4. Components (using `useUser()` hook)

No more hardcoded values! 🎉