# 🚀 Quick Start: Using the Edge Function SDK

## For Frontend Developers

### Before (Old Way ❌)
```typescript
// Manual fetch with boilerplate
const supabase = createClient()
const { data: { session } } = await supabase.auth.getSession()

const response = await fetch(
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/devices?organization_id=${orgId}`,
  {
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    }
  }
)

if (!response.ok) {
  throw new Error('Failed to fetch')
}

const data = await response.json()
```

### After (New Way ✅)
```typescript
// Simple SDK call
import { edgeFunctions } from '@/lib/edge-functions/client'

const response = await edgeFunctions.devices.list(orgId)

if (!response.success) {
  console.error(response.error?.message)
  return
}

const devices = response.data?.devices
```

---

## Available SDK Methods

### Devices
```typescript
// List devices
const response = await edgeFunctions.devices.list(organizationId)

// Create device
await edgeFunctions.devices.create({
  organization_id: orgId,
  name: 'Device Name',
  device_type: 'sensor'
})

// Update device
await edgeFunctions.devices.update(deviceId, { name: 'New Name' })

// Delete device
await edgeFunctions.devices.delete(deviceId)
```

### Locations
```typescript
// List locations
const response = await edgeFunctions.locations.list(organizationId)

// Create location
await edgeFunctions.locations.create({
  organization_id: orgId,
  name: 'Office',
  city: 'San Francisco',
  state: 'CA'
})

// Update location
await edgeFunctions.locations.update(locationId, {
  name: 'Updated Office'
})

// Delete location
await edgeFunctions.locations.delete(locationId)
```

### Alerts
```typescript
// List all alerts
const response = await edgeFunctions.alerts.list(organizationId)

// List with filters
const critical = await edgeFunctions.alerts.list(organizationId, {
  severity: 'critical',
  resolved: false,
  limit: 50
})

// Acknowledge alert
await edgeFunctions.alerts.acknowledge(alertId)

// Resolve alert
await edgeFunctions.alerts.resolve(alertId)
```

### Integrations
```typescript
// Test integration
const response = await edgeFunctions.integrations.test(integrationId)

// Trigger device sync
await edgeFunctions.integrations.sync({
  integrationId,
  organizationId,
  operation: 'bidirectional',
  deviceIds: ['device-1', 'device-2']
})
```

### Dashboard Stats
```typescript
// Get statistics
const response = await edgeFunctions.dashboardStats.get(organizationId)

if (response.success) {
  const { devices, alerts, integrations } = response.data
  console.log(`Total devices: ${devices.total}`)
  console.log(`Online: ${devices.online}`)
  console.log(`Unresolved alerts: ${alerts.unresolved}`)
}
```

### Members
```typescript
// List members
const response = await edgeFunctions.members.list(organizationId)

// Add member
await edgeFunctions.members.add(organizationId, {
  user_id: userId,
  role: 'member'
})

// Update role
await edgeFunctions.members.updateRole(organizationId, userId, 'admin')

// Remove member
await edgeFunctions.members.remove(organizationId, userId)
```

### Notifications
```typescript
// Send notification
await edgeFunctions.notifications.send({
  organization_id: orgId,
  integration_id: integrationId,
  message: 'Alert: Device offline',
  severity: 'warning'
})

// Test notification config
await edgeFunctions.notifications.test(integrationId)
```

### MQTT Broker
```typescript
// Connect to broker
await edgeFunctions.mqttBroker.connect({
  organization_id: orgId,
  integration_id: integrationId,
  action: 'connect'
})

// Publish message
await edgeFunctions.mqttBroker.connect({
  organization_id: orgId,
  integration_id: integrationId,
  action: 'publish',
  topic: 'devices/status',
  message: JSON.stringify({ status: 'online' })
})
```

---

## Response Format

All SDK methods return a standardized response:

```typescript
interface EdgeFunctionResponse<T> {
  success: boolean
  data?: T
  error?: {
    message: string
    status: number
    [key: string]: unknown
  }
  message?: string
  timestamp: string
}
```

### Success Response
```typescript
{
  success: true,
  data: { /* your data */ },
  timestamp: "2025-11-09T10:30:00.000Z"
}
```

### Error Response
```typescript
{
  success: false,
  error: {
    message: "Device not found",
    status: 404
  },
  timestamp: "2025-11-09T10:30:00.000Z"
}
```

---

## Error Handling Pattern

### Recommended Pattern
```typescript
const response = await edgeFunctions.devices.list(orgId)

if (!response.success) {
  // Handle error
  toast.error(response.error?.message || 'Operation failed')
  return
}

// Use data
const devices = response.data?.devices || []
```

### With Try-Catch (Optional)
```typescript
try {
  const response = await edgeFunctions.devices.list(orgId)
  
  if (!response.success) {
    throw new Error(response.error?.message)
  }
  
  return response.data?.devices
} catch (error) {
  console.error('Failed to load devices:', error)
  return []
}
```

---

## TypeScript Support

The SDK is fully typed. Your IDE will provide autocomplete:

```typescript
const response = await edgeFunctions.devices.list(orgId)

// TypeScript knows the response structure
if (response.success) {
  // ✅ TypeScript knows `data` exists
  const devices = response.data?.devices
  
  // ✅ Autocomplete for device properties
  devices.forEach(device => {
    console.log(device.name)
    console.log(device.status)
  })
}
```

---

## Debugging

### Development Logging

In development mode, all requests are automatically logged:

```
[EdgeFunction devices-1699564321-abc123] → GET devices { params: { organization_id: 'org-123' } }
[EdgeFunction devices-1699564321-abc123] ← 200 (145ms) { success: true, hasError: false }
```

### View Metrics

Open browser console and check metrics:

```javascript
// View last 100 API calls
const metrics = JSON.parse(sessionStorage.getItem('edge-function-metrics'))
console.table(metrics)

// Filter slow requests
const slow = metrics.filter(m => m.duration > 1000)
console.table(slow)
```

### Response Headers

Each response includes performance headers:

```
X-Response-Time: 145ms
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000
```

---

## Migration Guide

### Step 1: Import SDK
```typescript
import { edgeFunctions } from '@/lib/edge-functions/client'
```

### Step 2: Replace Manual Fetch
```diff
- const response = await fetch(`${url}/functions/v1/devices`, {
-   headers: {
-     'Authorization': `Bearer ${token}`,
-     'Content-Type': 'application/json'
-   }
- })
- const data = await response.json()

+ const response = await edgeFunctions.devices.list(orgId)
+ const data = response.data
```

### Step 3: Update Error Handling
```diff
- if (!response.ok) {
-   throw new Error('Failed')
- }

+ if (!response.success) {
+   console.error(response.error?.message)
+   return
+ }
```

### Step 4: Remove Auth Boilerplate
```diff
- const supabase = createClient()
- const { data: { session } } = await supabase.auth.getSession()
- // Auth handled automatically by SDK ✅
```

---

## Common Patterns

### Loading State
```typescript
const [loading, setLoading] = useState(false)

const loadDevices = async () => {
  setLoading(true)
  try {
    const response = await edgeFunctions.devices.list(orgId)
    if (response.success) {
      setDevices(response.data?.devices || [])
    } else {
      toast.error(response.error?.message)
    }
  } finally {
    setLoading(false)
  }
}
```

### Form Submission
```typescript
const handleSubmit = async (formData) => {
  setSaving(true)
  
  const response = await edgeFunctions.devices.create({
    organization_id: orgId,
    ...formData
  })
  
  if (response.success) {
    toast.success('Device created')
    closeDialog()
    refreshList()
  } else {
    toast.error(response.error?.message)
  }
  
  setSaving(false)
}
```

### Conditional Fetching
```typescript
useEffect(() => {
  if (currentOrganization) {
    edgeFunctions.devices.list(currentOrganization.id)
      .then(response => {
        if (response.success) {
          setDevices(response.data?.devices || [])
        }
      })
  }
}, [currentOrganization])
```

---

## Best Practices

### ✅ DO
- Always check `response.success` before using data
- Use SDK for all API calls (consistent interface)
- Handle errors gracefully with user-friendly messages
- Type your data when extracting from responses
- Use optional chaining: `response.data?.devices`

### ❌ DON'T
- Don't use manual fetch for edge functions
- Don't manage auth tokens manually
- Don't construct URLs manually
- Don't ignore error responses
- Don't forget to handle loading states

---

## Performance Tips

1. **Batch Requests**: Use Promise.all for parallel calls
```typescript
const [devices, alerts, stats] = await Promise.all([
  edgeFunctions.devices.list(orgId),
  edgeFunctions.alerts.list(orgId),
  edgeFunctions.dashboardStats.get(orgId)
])
```

2. **Cancel Pending Requests**: Use AbortController
```typescript
const controller = new AbortController()

// SDK doesn't support abort yet, but you can wrap it
useEffect(() => {
  return () => controller.abort()
}, [])
```

3. **Cache Results**: Use React Query or SWR
```typescript
import useSWR from 'swr'

const { data, error } = useSWR(
  `devices-${orgId}`,
  () => edgeFunctions.devices.list(orgId)
)
```

---

## Need Help?

- 📖 See `EDGE_FUNCTION_MIGRATION_COMPLETE.md` for detailed migration docs
- 📖 See `COMPLETE_SYSTEM_MODERNIZATION.md` for full system overview
- 🧪 Check `__tests__/lib/edge-functions-client.test.ts` for usage examples
- 🔍 Review `src/lib/edge-functions/client.ts` for all available methods

---

## Summary

✅ **Use SDK for all API calls**  
✅ **Always check response.success**  
✅ **Handle errors gracefully**  
✅ **Enjoy type safety and autocomplete**  
✅ **Monitor performance via console logs**

**The SDK handles auth, CORS, error formatting, and logging automatically!**
