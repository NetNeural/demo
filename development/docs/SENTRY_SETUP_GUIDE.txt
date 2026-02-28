# Ì¥ç Sentry Setup Guide for NetNeural

This guide covers setting up Sentry for error tracking in both your Next.js application and Supabase Edge Functions.

---

## Ì≥ã Prerequisites

1. Create a Sentry account at https://sentry.io
2. Create two projects in Sentry:
   - **Project 1:** "NetNeural Frontend" (Next.js)
   - **Project 2:** "NetNeural Supabase Functions" (Deno)
3. Get DSN keys for both projects

---

## Ìºê Part 1: Next.js Frontend Setup

### Step 1: Install Sentry SDK

```bash
npm install --save @sentry/nextjs
```

### Step 2: Run Sentry Wizard (Recommended)

```bash
npx @sentry/wizard@latest -i nextjs
```

This will:
- Create `sentry.client.config.ts`
- Create `sentry.server.config.ts`
- Create `sentry.edge.config.ts`
- Update `next.config.js`
- Create `.sentryclirc` for source maps

### Step 3: Manual Configuration (if not using wizard)

**Create `sentry.client.config.ts`:**
```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Performance Monitoring
  tracesSampleRate: 1.0, // Capture 100% of transactions (adjust in production)
  
  // Session Replay
  replaysSessionSampleRate: 0.1, // Sample 10% of sessions
  replaysOnErrorSampleRate: 1.0, // Sample 100% of sessions with errors
  
  integrations: [
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  
  environment: process.env.NODE_ENV,
  
  // Filter out sensitive data
  beforeSend(event) {
    // Don't send errors from localhost in development
    if (event.request?.url?.includes('localhost') && process.env.NODE_ENV === 'development') {
      return null;
    }
    return event;
  },
});
```

**Create `sentry.server.config.ts`:**
```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
  
  // Server-specific options
  debug: false,
});
```

**Create `sentry.edge.config.ts`:**
```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
});
```

**Update `next.config.js`:**
```javascript
const { withSentryConfig } = require('@sentry/nextjs');

const nextConfig = {
  // Your existing config...
  
  sentry: {
    // Upload source maps during build
    hideSourceMaps: true,
    
    // Automatically instrument API routes
    autoInstrumentServerFunctions: true,
    
    // Don't upload source maps in development
    disableServerWebpackPlugin: process.env.NODE_ENV === 'development',
    disableClientWebpackPlugin: process.env.NODE_ENV === 'development',
  },
};

const sentryWebpackPluginOptions = {
  silent: true, // Suppresses all logs
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
};

module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions);
```

### Step 4: Environment Variables

**Add to `.env.local`:**
```bash
# Sentry Frontend
NEXT_PUBLIC_SENTRY_DSN=https://YOUR_KEY@o1234567.ingest.sentry.io/1234567
SENTRY_AUTH_TOKEN=your_auth_token_here
SENTRY_ORG=your-org-name
SENTRY_PROJECT=netneural-frontend
```

**Add to `.env.development.production-db`:**
```bash
NEXT_PUBLIC_SENTRY_DSN=https://YOUR_KEY@o1234567.ingest.sentry.io/1234567
```

### Step 5: Add Error Boundary (Optional but Recommended)

**Create `src/components/ErrorBoundary.tsx`:**
```typescript
'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
        <p className="text-gray-600 mb-4">
          We've been notified and are looking into it.
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
```

**Use in `src/app/error.tsx`:**
```typescript
'use client';

import ErrorBoundary from '@/components/ErrorBoundary';

export default ErrorBoundary;
```

---

## Ì¥ß Part 2: Supabase Edge Functions Setup

### Step 1: Install Sentry for Deno

Each edge function needs to import Sentry. Create a shared utility.

**Create `supabase/functions/_shared/sentry.ts`:**
```typescript
import * as Sentry from "https://deno.land/x/sentry/index.mjs";

export function initSentry() {
  Sentry.init({
    dsn: Deno.env.get("SENTRY_DSN"),
    environment: Deno.env.get("ENVIRONMENT") || "development",
    tracesSampleRate: 1.0,
    
    // Add release tracking
    release: Deno.env.get("SENTRY_RELEASE") || "unknown",
  });
}

export function captureError(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    extra: context,
  });
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = "info") {
  Sentry.captureMessage(message, level);
}

export { Sentry };
```

### Step 2: Update Edge Functions to Use Sentry

**Example for any edge function:**
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { initSentry, captureError, Sentry } from "../_shared/sentry.ts";

// Initialize Sentry at the top
initSentry();

serve(async (req) => {
  try {
    // Your function logic here
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Example operation
    const { data, error } = await supabase
      .from("devices")
      .select("*");

    if (error) throw error;

    return new Response(
      JSON.stringify({ data }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    // Capture error in Sentry
    captureError(error as Error, {
      function: "your-function-name",
      url: req.url,
      method: req.method,
    });

    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  } finally {
    // Flush Sentry events before function ends
    await Sentry.close(2000);
  }
});
```

### Step 3: Set Supabase Secrets

```bash
# Set Sentry DSN for edge functions
npx supabase secrets set SENTRY_DSN=https://YOUR_KEY@o1234567.ingest.sentry.io/XXXXXX

# Optional: Set environment
npx supabase secrets set ENVIRONMENT=production

# Optional: Set release version
npx supabase secrets set SENTRY_RELEASE=$(git rev-parse HEAD)
```

**For local development, add to `supabase/.env`:**
```bash
SENTRY_DSN=https://YOUR_KEY@o1234567.ingest.sentry.io/XXXXXX
ENVIRONMENT=development
```

---

## Ì≥ä Part 3: Testing Sentry Integration

### Test Frontend

**Create a test page `src/app/test-sentry/page.tsx`:**
```typescript
'use client';

import * as Sentry from '@sentry/nextjs';

export default function TestSentry() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Sentry Test Page</h1>
      
      <button
        onClick={() => {
          throw new Error('Frontend Sentry Test Error');
        }}
        className="px-4 py-2 bg-red-600 text-white rounded mr-4"
      >
        Trigger Error
      </button>

      <button
        onClick={() => {
          Sentry.captureMessage('Test message from frontend', 'info');
          alert('Message sent to Sentry!');
        }}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        Send Test Message
      </button>
    </div>
  );
}
```

### Test Supabase Function

```bash
# Call your edge function with an intentional error
curl -X POST 'http://127.0.0.1:54321/functions/v1/your-function' \
  -H 'Content-Type: application/json' \
  -d '{"trigger_error": true}'
```

---

## ÌæØ Part 4: Best Practices

### 1. Performance Monitoring

**Track custom transactions:**
```typescript
import * as Sentry from '@sentry/nextjs';

async function fetchUserData(userId: string) {
  const transaction = Sentry.startTransaction({
    op: 'fetch',
    name: 'Fetch User Data',
  });

  try {
    const response = await fetch(`/api/users/${userId}`);
    const data = await response.json();
    return data;
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  } finally {
    transaction.finish();
  }
}
```

### 2. User Context

**Set user context after authentication:**
```typescript
import * as Sentry from '@sentry/nextjs';

// In your auth callback or layout
Sentry.setUser({
  id: user.id,
  email: user.email,
  username: user.full_name,
});

// Clear on logout
Sentry.setUser(null);
```

### 3. Custom Tags and Context

```typescript
Sentry.setTag('organization_id', orgId);
Sentry.setContext('device', {
  type: deviceType,
  model: deviceModel,
});
```

### 4. Filter Sensitive Data

```typescript
// In sentry.client.config.ts
beforeSend(event, hint) {
  // Remove sensitive query parameters
  if (event.request?.url) {
    const url = new URL(event.request.url);
    url.searchParams.delete('token');
    url.searchParams.delete('api_key');
    event.request.url = url.toString();
  }
  
  // Filter out known errors
  if (event.exception?.values?.[0]?.value?.includes('Network error')) {
    return null; // Don't send to Sentry
  }
  
  return event;
}
```

---

## Ì≥ù Part 5: Integration with Existing Error Handling

### Update API Routes

```typescript
// src/app/api/devices/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

export async function GET(req: NextRequest) {
  try {
    // Your logic
    const devices = await fetchDevices();
    return NextResponse.json({ devices });
  } catch (error) {
    Sentry.captureException(error, {
      extra: {
        endpoint: '/api/devices',
        method: 'GET',
      },
    });
    
    return NextResponse.json(
      { error: 'Failed to fetch devices' },
      { status: 500 }
    );
  }
}
```

### Update Server Actions

```typescript
'use server';

import * as Sentry from '@sentry/nextjs';

export async function saveProfile(formData: FormData) {
  try {
    // Your logic
    const result = await updateProfile(formData);
    return { success: true, data: result };
  } catch (error) {
    Sentry.captureException(error, {
      extra: { action: 'saveProfile' },
    });
    
    return { success: false, error: 'Failed to save profile' };
  }
}
```

---

## Ì∫Ä Part 6: Deployment Checklist

### Before Deploying:

1. **Set production environment variables:**
   - `NEXT_PUBLIC_SENTRY_DSN`
   - `SENTRY_AUTH_TOKEN`
   - `SENTRY_ORG`
   - `SENTRY_PROJECT`

2. **Configure source maps upload:**
   - Ensure `SENTRY_AUTH_TOKEN` is in GitHub Secrets
   - Verify `.sentryclirc` is in `.gitignore`

3. **Set Supabase secrets:**
   ```bash
   npx supabase secrets set SENTRY_DSN=YOUR_PRODUCTION_DSN --project-ref YOUR_PROJECT_REF
   ```

4. **Adjust sample rates for production:**
   ```typescript
   tracesSampleRate: 0.1, // 10% in production
   replaysSessionSampleRate: 0.01, // 1% in production
   ```

5. **Enable release tracking:**
   ```bash
   # In your deployment workflow
   SENTRY_RELEASE=$(git rev-parse HEAD)
   ```

---

## Ì≥ñ Quick Reference

### Common Sentry Commands

```bash
# Install Sentry CLI globally
npm install -g @sentry/cli

# Upload source maps manually
sentry-cli sourcemaps upload --org YOUR_ORG --project YOUR_PROJECT ./out

# Create a release
sentry-cli releases new YOUR_RELEASE
sentry-cli releases set-commits YOUR_RELEASE --auto
sentry-cli releases finalize YOUR_RELEASE
```

### Useful Sentry Features

1. **Source Maps:** Debug minified production code
2. **Breadcrumbs:** See user actions leading to error
3. **Session Replay:** Watch user session that caused error
4. **Performance Monitoring:** Track slow API calls
5. **Alerts:** Get notified of new errors
6. **Issue Grouping:** Automatic error deduplication

---

## Ì¥ó Resources

- [Sentry Next.js Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Deno Docs](https://docs.sentry.io/platforms/javascript/guides/deno/)
- [Sentry Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Sentry Session Replay](https://docs.sentry.io/product/session-replay/)

---

**Next Steps:**
1. Create Sentry projects
2. Run `npx @sentry/wizard@latest -i nextjs`
3. Configure Supabase edge functions
4. Test both integrations
5. Deploy with proper environment variables

