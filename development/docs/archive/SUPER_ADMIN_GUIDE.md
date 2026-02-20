# Super Admin Implementation Guide

## Overview

The platform needs a **super admin** role that can:

- Manage multiple organizations
- View all data across all orgs
- Create/edit/delete organizations
- Manage users across all organizations
- Access platform-wide analytics
- Configure global settings

This is distinct from **org_owner** who can only manage their own organization.

## Role Hierarchy

```
super_admin        ← Platform administrator (NetNeural staff)
    ↓
org_owner          ← Organization owner (customer admin)
    ↓
org_admin          ← Organization administrator (can manage users/devices)
    ↓
user               ← Regular user (can use devices)
    ↓
viewer             ← Read-only access
```

## Current Schema

✅ **Already defined** in `supabase/migrations/20241201000001_init_schema.sql`:

```sql
CREATE TYPE user_role AS ENUM ('super_admin', 'org_admin', 'org_owner', 'user', 'viewer');
```

✅ **Users table supports it**:

```sql
role user_role DEFAULT 'user',
organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
```

**Key design**: Super admins can have `organization_id = NULL` since they manage multiple orgs.

## Capabilities Comparison

| Capability               | Super Admin | Org Owner | Org Admin | User    | Viewer  |
| ------------------------ | ----------- | --------- | --------- | ------- | ------- |
| **Organizations**        |
| View all orgs            | ✅          | ❌        | ❌        | ❌      | ❌      |
| Create orgs              | ✅          | ❌        | ❌        | ❌      | ❌      |
| Edit any org             | ✅          | Own only  | ❌        | ❌      | ❌      |
| Delete orgs              | ✅          | ❌        | ❌        | ❌      | ❌      |
| Manage org settings      | ✅          | Own only  | ❌        | ❌      | ❌      |
| **Users**                |
| View all users           | ✅          | Own org   | Own org   | ❌      | ❌      |
| Create users             | ✅          | Own org   | Own org   | ❌      | ❌      |
| Edit any user            | ✅          | Own org   | Own org   | ❌      | ❌      |
| Delete users             | ✅          | Own org   | Own org   | ❌      | ❌      |
| Change user roles        | ✅          | Own org   | Own org   | ❌      | ❌      |
| **Devices**              |
| View all devices         | ✅          | Own org   | Own org   | Own org | Own org |
| Create devices           | ✅          | Own org   | Own org   | ✅      | ❌      |
| Edit devices             | ✅          | Own org   | Own org   | ✅      | ❌      |
| Delete devices           | ✅          | Own org   | Own org   | ❌      | ❌      |
| **Analytics**            |
| Platform-wide stats      | ✅          | ❌        | ❌        | ❌      | ❌      |
| Org analytics            | ✅          | Own org   | Own org   | ❌      | ❌      |
| Device analytics         | ✅          | Own org   | Own org   | Own org | Own org |
| **Settings**             |
| Global platform settings | ✅          | ❌        | ❌        | ❌      | ❌      |
| Organization settings    | ✅          | Own org   | ❌        | ❌      | ❌      |
| Integration settings     | ✅          | Own org   | Own org   | ❌      | ❌      |
| User preferences         | ✅          | ✅        | ✅        | ✅      | ✅      |

## Implementation Steps

### 1. Create Super Admin User

Add to `supabase/seed.sql`:

```sql
-- Insert super admin (NetNeural platform administrator)
INSERT INTO users (id, email, full_name, role, organization_id, is_active) VALUES
('10000000-0000-0000-0000-000000000000', 'superadmin@netneural.ai', 'Super Administrator', 'super_admin', NULL, true)
ON CONFLICT (id) DO NOTHING;
```

**Note**: `organization_id` is `NULL` for super admins.

### 2. Update Auth Context

Modify `src/lib/auth.ts`:

```typescript
export interface UserProfile {
  id: string
  email: string
  organizationId: string | null // NULL for super admins
  organizationName: string | null
  role: 'super_admin' | 'org_owner' | 'org_admin' | 'user' | 'viewer'
  isSuperAdmin: boolean // Helper flag
}

export async function getCurrentUser(): Promise<UserProfile | null> {
  const supabase = createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (!user || authError) {
    return null
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select(
      `
      role,
      organization:organizations(
        id,
        name
      )
    `
    )
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    console.error('Failed to fetch user profile:', profileError)
    return null
  }

  // Super admins don't have an organization
  const isSuperAdmin = profile.role === 'super_admin'
  const org = profile.organization as { id: string; name: string } | null

  return {
    id: user.id,
    email: user.email || '',
    organizationId: isSuperAdmin ? null : org?.id || null,
    organizationName: isSuperAdmin ? null : org?.name || null,
    role: profile.role,
    isSuperAdmin,
  }
}
```

### 3. Create Permission Helper

Create `src/lib/permissions.ts`:

```typescript
import { UserProfile } from './auth'

export function canViewAllOrganizations(user: UserProfile): boolean {
  return user.isSuperAdmin
}

export function canManageOrganization(
  user: UserProfile,
  orgId: string
): boolean {
  return user.isSuperAdmin || user.organizationId === orgId
}

export function canCreateOrganization(user: UserProfile): boolean {
  return user.isSuperAdmin
}

export function canDeleteOrganization(user: UserProfile): boolean {
  return user.isSuperAdmin
}

export function canViewAllUsers(user: UserProfile): boolean {
  return user.isSuperAdmin
}

export function canManageUser(user: UserProfile, targetOrgId: string): boolean {
  return user.isSuperAdmin || user.organizationId === targetOrgId
}

export function canViewPlatformAnalytics(user: UserProfile): boolean {
  return user.isSuperAdmin
}

export function canConfigureGlobalSettings(user: UserProfile): boolean {
  return user.isSuperAdmin
}

export function canAccessOrganization(
  user: UserProfile,
  orgId: string
): boolean {
  return user.isSuperAdmin || user.organizationId === orgId
}
```

### 4. Update Edge Functions

Modify edge functions to handle super admin access:

**`supabase/functions/devices/index.ts`**:

```typescript
// Get organization_id from query params
const organizationId = url.searchParams.get('organization_id')

// Get user's role from auth
const {
  data: { user },
} = await supabaseClient.auth.getUser()
const { data: userProfile } = await supabaseClient
  .from('users')
  .select('role, organization_id')
  .eq('id', user.id)
  .single()

let query = supabaseClient.from('devices').select('*')

// Super admins can view all orgs
if (userProfile.role === 'super_admin') {
  if (organizationId) {
    // Super admin requesting specific org
    query = query.eq('organization_id', organizationId)
  }
  // Otherwise return all devices from all orgs
} else {
  // Regular users: filter by their org
  query = query.eq('organization_id', userProfile.organization_id)
}

const { data: devices, error } = await query
```

### 5. Create Super Admin Dashboard

Create `src/app/superadmin/page.tsx`:

```typescript
'use client'

import { useUser } from '@/contexts/UserContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function SuperAdminDashboard() {
  const { user, loading } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user?.isSuperAdmin) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  if (loading) return <div>Loading...</div>
  if (!user?.isSuperAdmin) return null

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Super Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Organizations Card */}
        <div className="card">
          <h2>Organizations</h2>
          <p>Manage all organizations</p>
          <a href="/superadmin/organizations">View All →</a>
        </div>

        {/* Users Card */}
        <div className="card">
          <h2>Users</h2>
          <p>Manage all users</p>
          <a href="/superadmin/users">View All →</a>
        </div>

        {/* Platform Analytics */}
        <div className="card">
          <h2>Platform Analytics</h2>
          <p>View platform-wide statistics</p>
          <a href="/superadmin/analytics">View Stats →</a>
        </div>
      </div>
    </div>
  )
}
```

### 6. Add Organization Selector for Super Admin

Modify `src/app/dashboard/layout.tsx`:

```typescript
function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser()
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const [organizations, setOrganizations] = useState([])

  // Super admins can select organization
  useEffect(() => {
    if (user?.isSuperAdmin) {
      fetchAllOrganizations().then(setOrganizations)
    }
  }, [user])

  return (
    <div className="dashboard-container">
      <nav className="nav-sidebar">
        <div className="nav-header">
          <h1 className="nav-brand">NetNeural IoT</h1>

          {/* Super Admin Badge */}
          {user?.isSuperAdmin && (
            <span className="badge badge-admin">Super Admin</span>
          )}

          {/* Organization Selector for Super Admins */}
          {user?.isSuperAdmin && (
            <select
              value={selectedOrgId || ''}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="org-selector"
            >
              <option value="">All Organizations</option>
              {organizations.map(org => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="nav-menu">
          {/* Regular Dashboard Links */}
          <a href="/dashboard">Dashboard</a>
          <a href="/dashboard/devices">Devices</a>
          <a href="/dashboard/alerts">Alerts</a>

          {/* Super Admin Only Links */}
          {user?.isSuperAdmin && (
            <>
              <hr />
              <a href="/superadmin">Super Admin</a>
              <a href="/superadmin/organizations">All Organizations</a>
              <a href="/superadmin/users">All Users</a>
              <a href="/superadmin/analytics">Platform Analytics</a>
            </>
          )}
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}
```

### 7. Update Row Level Security (RLS)

Super admins should bypass organization filters. Add to migrations:

```sql
-- Super admins can view all devices
CREATE POLICY "super_admins_view_all_devices"
ON devices FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'super_admin'
  )
);

-- Super admins can manage all organizations
CREATE POLICY "super_admins_manage_all_orgs"
ON organizations FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'super_admin'
  )
);
```

## Setup Instructions

### 1. Add Super Admin to Seed Data

```bash
# Edit supabase/seed.sql to add super admin user
```

### 2. Reset Database

```bash
npm run supabase:reset
```

### 3. Create Auth User for Super Admin

```bash
# Add to scripts/create-test-users.js:
{
  id: '10000000-0000-0000-0000-000000000000',
  email: 'superadmin@netneural.ai',
  password: 'SuperSecure123!',
  full_name: 'Super Administrator',
  role: 'super_admin'
}

npm run setup:users
```

### 4. Login as Super Admin

```
Email: superadmin@netneural.ai
Password: SuperSecure123!
```

## Testing Super Admin

### Test Case 1: View All Organizations

```typescript
// As super admin
const orgs = await fetchEdgeFunction('organizations')
// Should return all organizations
```

### Test Case 2: View Devices from Any Org

```typescript
// As super admin
const devices = await fetchEdgeFunction('devices', {
  organization_id: 'any-org-id',
})
// Should return that org's devices
```

### Test Case 3: Organization Switching

```typescript
// Super admin can switch between orgs in UI
setSelectedOrg('org-1') // View org 1's data
setSelectedOrg('org-2') // View org 2's data
setSelectedOrg(null) // View all orgs
```

## Security Considerations

### ⚠️ Super Admin Creation

- **Never expose super admin creation in UI**
- Only create via database seeds or manual SQL
- Require strong passwords
- Enable 2FA/MFA for super admins

### ⚠️ Audit Logging

```sql
-- Log all super admin actions
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### ⚠️ Access Control

- Super admin routes should check `user.isSuperAdmin`
- Edge functions should verify role from database
- Never trust client-side role checks alone

## UI Components

### Super Admin Badge

```tsx
{
  user?.isSuperAdmin && (
    <span className="inline-flex items-center rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
      🛡️ Super Admin
    </span>
  )
}
```

### Conditional Rendering

```tsx
{
  user?.isSuperAdmin ? <SuperAdminView /> : <RegularUserView />
}
```

## Summary

✅ **Schema Ready**: `super_admin` role already defined
✅ **Flexible Design**: `organization_id` can be NULL
✅ **Clear Hierarchy**: 5 distinct roles with clear capabilities
✅ **Security Focused**: Proper permission checks

**Next Steps**:

1. Add super admin user to seed.sql
2. Update auth context to handle NULL organization
3. Create permission helpers
4. Build super admin UI
5. Update edge functions for super admin access

Would you like me to implement any of these components now?
