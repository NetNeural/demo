# Quick Reference: No Hardcoded Values

## Setup Commands

```bash
# 1. Reset database
npm run supabase:reset

# 2. Create auth users
npm run setup:users

# 3. Start services (2 terminals)
npm run supabase:functions:serve  # Terminal 1
npm run dev                       # Terminal 2
```

## Login Credentials

```
Admin:  admin@netneural.ai / password123
User:   user@netneural.ai / password123
Viewer: viewer@netneural.ai / password123
```

## Use in Components

```typescript
import { useUser } from '@/contexts/UserContext'
import { fetchEdgeFunction } from '@/lib/auth'

function MyComponent() {
  const { user, loading } = useUser()

  if (!user) return null

  // Access user data
  user.id // User ID
  user.email // Email
  user.organizationId // Org ID
  user.organizationName // Org name
  user.role // Role

  // Make API calls
  const data = await fetchEdgeFunction('devices', {
    organization_id: user.organizationId,
  })
}
```

## Files Created

```
src/lib/auth.ts                 - Auth utilities
src/contexts/UserContext.tsx    - User context provider
scripts/create-test-users.js    - Test user setup
```

## Files Modified

```
src/app/dashboard/layout.tsx              - Uses UserProvider
src/components/dashboard/DeviceStatusCard.tsx  - Uses useUser()
supabase/seed.sql                         - Added test users
package.json                              - Added setup:users script
```

## Documentation

```
HARDCODED_VALUES_SUMMARY.md          - Start here
SETUP_GUIDE_NO_HARDCODED_VALUES.md   - Full setup guide
REMOVING_HARDCODED_VALUES.md         - Technical details
CHECKLIST_HARDCODED_VALUES.md        - Progress tracker
```

## Data Flow

```
User Login
    ↓
Supabase Auth (auth.users)
    ↓
getCurrentUser() → users table + organizations
    ↓
UserProvider → React Context
    ↓
useUser() hook → Components
    ↓
fetchEdgeFunction() → organization_id param
    ↓
Edge Function → Filter by org
    ↓
Database → Return org's data only
```

## Key Functions

```typescript
// Get current user
const user = await getCurrentUser()

// Make API call
const data = await fetchEdgeFunction('endpoint', {
  organization_id: user.organizationId,
})

// Use in component
const { user, loading } = useUser()
```

## Test URLs

```
Login:    http://localhost:3000/auth/login
Dashboard: http://localhost:3000/dashboard
Devices:  http://localhost:3000/dashboard/devices
Studio:   http://localhost:54323
```

## Verify Setup

```bash
# Check database has users
npm run supabase:studio
# → Authentication → Users → Should see 3 users

# Check devices endpoint
curl -H "Authorization: Bearer $ANON_KEY" \
  "http://localhost:54321/functions/v1/devices?organization_id=00000000-0000-0000-0000-000000000001"
# → Should return 20 devices

# Check type safety
npm run type-check
# → Should pass with no errors
```

## Common Issues

| Issue                  | Solution                               |
| ---------------------- | -------------------------------------- |
| "User not found"       | Run `npm run setup:users`              |
| "No devices"           | Check org ID matches seed data         |
| "Redirecting to login" | Sign in at `/auth/login`               |
| "Edge functions 503"   | Run `npm run supabase:functions:serve` |

## Status

✅ **Core complete** - No hardcoded values!

- Dynamic user from auth
- Dynamic organization filtering
- All data from database
- Multi-tenant ready

## Next Component to Update

```typescript
// Example: AlertsCard.tsx
import { useUser } from '@/contexts/UserContext'
import { fetchEdgeFunction } from '@/lib/auth'

export function AlertsCard() {
  const { user } = useUser()

  const fetchAlerts = async () => {
    const data = await fetchEdgeFunction('alerts', {
      organization_id: user.organizationId, // ✅ Dynamic!
    })
  }
}
```
