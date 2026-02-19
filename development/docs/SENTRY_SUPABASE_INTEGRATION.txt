# í¾¯ Supabase + Sentry Integration Guide

Supabase has an **official Sentry integration** that makes it much easier to track errors from Supabase client operations!

---

## í³¦ Install the Integration

```bash
npm install @supabase/sentry-js-integration @sentry/nextjs
```

---

## í´§ Setup (Much Simpler!)

### 1. Update Sentry Client Config

**Edit `sentry.client.config.ts`:**

```typescript
import * as Sentry from "@sentry/nextjs";
import { SupabaseIntegration } from "@supabase/sentry-js-integration";
import { SupabaseClient } from "@supabase/supabase-js";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  integrations: [
    new SupabaseIntegration(SupabaseClient, Sentry, {
      tracing: true,  // Enable performance tracing for Supabase queries
      breadcrumbs: true,  // Add breadcrumbs for all Supabase operations
      errors: true,  // Capture Supabase errors
    }),
    
    // Session Replay (optional)
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  
  // Performance Monitoring
  tracesSampleRate: 1.0,
  
  // Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  
  environment: process.env.NODE_ENV,
  
  beforeSend(event) {
    if (event.request?.url?.includes('localhost') && process.env.NODE_ENV === 'development') {
      return null;
    }
    return event;
  },
});
```

### 2. Update Sentry Server Config

**Edit `sentry.server.config.ts`:**

```typescript
import * as Sentry from "@sentry/nextjs";
import { SupabaseIntegration } from "@supabase/sentry-js-integration";
import { SupabaseClient } from "@supabase/supabase-js";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  integrations: [
    new SupabaseIntegration(SupabaseClient, Sentry, {
      tracing: true,
      breadcrumbs: true,
      errors: true,
    }),
  ],
  
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
  debug: false,
});
```

---

## âœ¨ What This Integration Does Automatically

### 1. **Automatic Error Tracking**
All Supabase errors are automatically captured:
```typescript
// Errors are automatically sent to Sentry!
const { data, error } = await supabase
  .from('devices')
  .select('*');

if (error) {
  // Error is already captured by Sentry integration
  console.error(error);
}
```

### 2. **Performance Tracing**
Track how long Supabase queries take:
- Database queries
- Auth operations
- Storage operations
- Realtime subscriptions

### 3. **Breadcrumbs**
See all Supabase operations leading to an error:
```
1. supabase.auth.signIn
2. supabase.from('users').select()
3. supabase.from('devices').insert()
4. ERROR: Foreign key constraint violation
```

### 4. **Query Details**
Sentry shows you:
- Table name
- Operation type (select, insert, update, delete)
- Query filters
- Response time
- Row count

---

## í¾¨ Advanced Usage

### Custom Error Context

```typescript
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/lib/supabase/client';

async function fetchDevices(orgId: string) {
  const supabase = createClient();
  
  // Add custom context
  Sentry.setContext('query', {
    table: 'devices',
    organization_id: orgId,
    user_role: 'admin',
  });
  
  const { data, error } = await supabase
    .from('devices')
    .select('*')
    .eq('organization_id', orgId);
  
  if (error) {
    // Automatically captured with custom context!
    return { data: null, error };
  }
  
  return { data, error: null };
}
```

### Track Specific Operations

```typescript
import * as Sentry from '@sentry/nextjs';

// Manually create a span for complex operations
async function complexDatabaseOperation() {
  const transaction = Sentry.startTransaction({
    op: 'db.operation',
    name: 'Complex Multi-Table Query',
  });
  
  try {
    // Supabase operations here
    const devices = await getDevices();
    const alerts = await getAlerts();
    const stats = await calculateStats();
    
    transaction.setStatus('ok');
    return { devices, alerts, stats };
  } catch (error) {
    transaction.setStatus('error');
    throw error;
  } finally {
    transaction.finish();
  }
}
```

---

## íº€ Quick Setup Script

Run this to get started immediately:

```bash
# 1. Install packages
npm install @supabase/sentry-js-integration @sentry/nextjs

# 2. Run Sentry wizard
npx @sentry/wizard@latest -i nextjs

# 3. Add Supabase integration to generated config files
# (Manual step - see config examples above)

# 4. Add DSN to .env.local
echo "NEXT_PUBLIC_SENTRY_DSN=your-dsn-here" >> .env.local

# 5. Test it
npm run dev
```

---

## í³Š What You'll See in Sentry

### Performance Tab
- `db.query` - All Supabase queries
- `db.auth` - Authentication operations
- `db.storage` - Storage operations
- Average query times
- Slow query alerts

### Issues Tab
- Supabase RPC errors
- Constraint violations
- Permission errors
- Connection timeouts
- Rate limit errors

### Breadcrumbs
```
10:23:45 - supabase.auth.getUser()
10:23:46 - supabase.from('organizations').select()
10:23:47 - supabase.from('devices').insert()
10:23:48 - ERROR: null value in column "organization_id"
```

---

## í´’ Security Best Practices

### Filter Sensitive Data

```typescript
// In sentry.client.config.ts
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  beforeSend(event) {
    // Remove sensitive breadcrumb data
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
        if (breadcrumb.category === 'supabase.auth') {
          // Mask auth tokens
          if (breadcrumb.data) {
            breadcrumb.data = {
              ...breadcrumb.data,
              access_token: '[Filtered]',
              refresh_token: '[Filtered]',
            };
          }
        }
        return breadcrumb;
      });
    }
    
    // Don't send localhost errors
    if (event.request?.url?.includes('localhost')) {
      return null;
    }
    
    return event;
  },
});
```

---

## í¾¯ Real-World Example

**Complete API Route with Sentry + Supabase:**

```typescript
// app/api/devices/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as Sentry from '@sentry/nextjs';

export async function GET(req: NextRequest) {
  const transaction = Sentry.startTransaction({
    op: 'http.server',
    name: 'GET /api/devices',
  });

  try {
    const supabase = createClient();
    
    // Set user context
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      Sentry.setUser({
        id: user.id,
        email: user.email,
      });
    }
    
    // Query is automatically traced by Supabase integration!
    const { data: devices, error } = await supabase
      .from('devices')
      .select('*, organization:organizations(name)')
      .order('created_at', { ascending: false });
    
    if (error) {
      // Error automatically captured by integration
      throw error;
    }
    
    transaction.setStatus('ok');
    return NextResponse.json({ devices });
    
  } catch (error) {
    transaction.setStatus('error');
    
    // Add extra context
    Sentry.captureException(error, {
      tags: {
        endpoint: '/api/devices',
        method: 'GET',
      },
    });
    
    return NextResponse.json(
      { error: 'Failed to fetch devices' },
      { status: 500 }
    );
  } finally {
    transaction.finish();
  }
}
```

---

## í³ Comparison: With vs Without Integration

### âŒ Without Integration (Manual)
```typescript
const { data, error } = await supabase.from('devices').select();

if (error) {
  // Must manually capture every error
  Sentry.captureException(error, {
    extra: {
      table: 'devices',
      operation: 'select',
    },
  });
}
```

### âœ… With Integration (Automatic)
```typescript
const { data, error } = await supabase.from('devices').select();

if (error) {
  // Already captured with full context!
  // Just handle the error in your app
  console.error(error);
}
```

---

## í´ Debugging Tips

### View All Supabase Operations

In Sentry Performance tab, filter by:
- `op:db.query` - See all queries
- `op:db.auth` - See auth operations
- `op:db.storage` - See storage operations

### Find Slow Queries

1. Go to Performance â†’ Queries
2. Sort by "P95 Duration"
3. Identify queries taking >1s
4. Optimize with indexes or query changes

### Track Error Patterns

1. Go to Issues
2. Filter by `integration:supabase`
3. Group by error message
4. Fix the most common issues first

---

## í¾‰ Benefits Summary

âœ… **Zero-config error tracking** - All Supabase errors automatically captured  
âœ… **Performance insights** - See slow queries and operations  
âœ… **Full context** - Table names, operations, filters included  
âœ… **Breadcrumb trail** - See sequence of operations before error  
âœ… **Production-ready** - Used by Supabase team internally  
âœ… **Type-safe** - Full TypeScript support  

---

## í³š Resources

- [Official Integration Docs](https://github.com/supabase-community/sentry-integration-js)
- [Sentry Next.js Guide](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Supabase Error Handling](https://supabase.com/docs/guides/api/handling-errors)

---

## íº€ Next Steps

1. âœ… Install: `npm install @supabase/sentry-js-integration @sentry/nextjs`
2. âœ… Run wizard: `npx @sentry/wizard@latest -i nextjs`
3. âœ… Add Supabase integration to config files
4. âœ… Add DSN to environment variables
5. âœ… Test with a test error
6. âœ… Deploy and monitor!

**This is MUCH better than manually tracking Supabase errors!** í¾¯
