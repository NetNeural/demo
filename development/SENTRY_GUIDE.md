# Sentry Error Tracking - Developer Guide

## ✅ Setup Complete

Sentry is now configured globally across the application. Errors are automatically tracked!

## 🎯 Automatic Error Tracking

The following errors are **automatically** sent to Sentry:

### 1. **Unhandled Errors**

Any uncaught JavaScript error will automatically go to Sentry.

```typescript
// This will automatically be caught and sent to Sentry
throw new Error('Something went wrong!')
```

### 2. **Unhandled Promise Rejections**

```typescript
// This will automatically be caught
async function fetchData() {
  throw new Error('API failed')
}
fetchData() // No catch - Sentry captures it!
```

### 3. **React Component Errors**

Any error in React rendering will be caught by the global error boundary.

## 🛠️ Manual Error Reporting

### Use the Utility Functions

Import from `@/lib/sentry-utils`:

```typescript
import { handleApiError, reportError } from '@/lib/sentry-utils'
```

### 1. **API Errors** (Recommended)

**The `handleApiError` utility automatically:**

- ✅ Sends error to Sentry with context
- ✅ Shows user feedback dialog in production for 4xx/5xx errors
- ✅ Uses appropriate error messages based on status code

```typescript
try {
  const response = await fetch('/api/users')

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const error = new Error(errorData.error || `HTTP ${response.status}`)

    // This ONE line does everything:
    // - Sends to Sentry
    // - Shows feedback dialog in production
    // - Adds context and tags
    handleApiError(error, {
      endpoint: '/api/users',
      method: 'GET',
      status: response.status,
      errorData,
      context: {
        user_id: userId,
        custom_data: 'any extra info',
      },
    })

    throw error
  }
} catch (error) {
  // If it's not an HTTP error, still send it
  if (error instanceof Error && !error.message.includes('HTTP')) {
    handleApiError(error, {
      endpoint: '/api/users',
      method: 'GET',
      context: { component: 'UsersList' },
    })
  }
}
```

**To disable feedback dialog for specific errors:**

```typescript
handleApiError(error, {
  endpoint: '/api/users',
  status: response.status,
  showFeedbackDialog: false, // Suppress dialog for this error
})
```

### 2. **Custom Error Reporting**

```typescript
// Simple error
reportError('Something unexpected happened')

// Error with context
reportError(new Error('Payment failed'), {
  component: 'CheckoutForm',
  action: 'processPayment',
  extra: {
    amount: 100,
    currency: 'USD',
  },
  tags: {
    payment_provider: 'stripe',
  },
})
```

### 3. **Direct Sentry API** (Advanced)

```typescript
import * as Sentry from '@sentry/nextjs'

Sentry.captureException(error, {
  extra: {
    custom_data: 'value',
  },
  tags: {
    feature: 'authentication',
  },
})
```

## 📋 What Gets Sent to Sentry

### Automatically Included:

- ✅ Error message and stack trace
- ✅ User information (if authenticated)
- ✅ Breadcrumbs (user actions leading to error)
- ✅ Environment (development/production)
- ✅ Browser/Device information
- ✅ URL and page context

### You Can Add:

- ✅ Custom tags (for filtering)
- ✅ Extra context data
- ✅ User feedback
- ✅ Custom breadcrumbs

## 🔒 Security

**Automatically Filtered:**

- ❌ Authorization headers
- ❌ Access tokens
- ❌ Refresh tokens
- ❌ Password fields

## 🎭 Environment Behavior

### Development:

- Errors sent to Sentry
- Console logs visible
- **No popup dialog** (less intrusive)
- Full stack traces

### Production:

- Errors sent to Sentry
- **User feedback dialog appears automatically for API errors (4xx/5xx)**
- Session replay enabled
- Source maps for debugging

## 🎭 Feedback Dialog Behavior

### **Automatic Feedback Dialogs:**

The user will see a feedback popup automatically in production for:

1. **All API Errors (4xx/5xx)** - via `handleApiError()`
   - 400 Bad Request: "Invalid Request"
   - 401/403 Unauthorized: "Access Denied"
   - 404 Not Found: "Not Found"
   - 500+ Server Errors: "Server Error"

2. **Unhandled Errors** - via global error handler
3. **React Rendering Errors** - via global error boundary

### **Dialog Messages:**

The dialog automatically shows context-appropriate messages:

- **401/403**: "You don't have permission to perform this action"
- **404**: "The resource you're looking for doesn't exist"
- **500+**: "Our servers encountered an issue"
- **400**: "The request couldn't be processed"

### **Disabling Dialog:**

To suppress feedback dialog for specific errors:

```typescript
handleApiError(error, {
  endpoint: '/api/analytics',
  showFeedbackDialog: false, // Silent error
})
```

## 📊 Viewing Errors

1. Go to https://sentry.io
2. Navigate to your project
3. Click "Issues" to see all errors
4. Click an issue to see:
   - Stack trace
   - Breadcrumbs
   - User session replay
   - Context data

## 🧪 Testing

Visit `/test-sentry` to test different error scenarios.

## ❌ Errors That Are Ignored

The following are automatically ignored (noise reduction):

- ResizeObserver loop limit exceeded
- Network errors (Failed to fetch)
- Browser extension errors
- Chunk load errors (build artifacts)

## 💡 Best Practices

### For New Pages

**IMPORTANT**: Use the page template to ensure Sentry is always included:

```bash
# Copy the template when creating a new page
cp src/templates/page-template.tsx src/app/your-route/page.tsx
```

The template includes:

- ✅ Automatic error handling setup
- ✅ API error handling examples with `handleApiError`
- ✅ Error boundary wrapper example
- ✅ Proper imports and structure
- ✅ JSDoc comments explaining each pattern

### Error Boundaries

All major routes have automatic error boundaries that catch React errors:

- **Root level**: `global-error.tsx` - Catches all unhandled errors across the app
- **Dashboard**: `app/dashboard/error.tsx` - Dashboard-specific errors with custom UI
- **Auth**: `app/auth/error.tsx` - Authentication errors with custom messaging

For custom error boundaries in specific components:

```tsx
import { ErrorBoundaryWrapper } from '@/lib/error-boundary-wrapper';

// Wrap any risky component
<ErrorBoundaryWrapper>
  <ComplexDataVisualization />
</ErrorBoundaryWrapper>

// With custom fallback UI
<ErrorBoundaryWrapper fallback={<CustomErrorUI />}>
  <ThirdPartyWidget />
</ErrorBoundaryWrapper>

// With error callback
<ErrorBoundaryWrapper onError={(error, errorInfo) => {
  console.log('Component failed:', error);
}}>
  <YourComponent />
</ErrorBoundaryWrapper>
```

### General Guidelines

1. **Let most errors bubble up** - They'll be caught automatically by error boundaries
2. **Use handleApiError for ALL API calls** - Provides consistent context and user feedback
3. **Add custom context** when it helps debugging (user ID, feature flags, etc.)
4. **Don't over-report** - Not every console.log needs Sentry
5. **Use tags** for filtering in Sentry dashboard (feature, component, etc.)
6. **Use the page template** for new pages to ensure consistency

## 📞 Need Help?

Check the Sentry dashboard or ask the team!
