# MQTT Page Mode Implementation

**Date:** November 13, 2025  
**Status:** ✅ Complete  
**Build:** Successful

## Overview

Fixed MQTT integration to render as an inline page instead of a modal overlay when navigating directly to `/dashboard/integrations/mqtt/[id]`.

## Problem

When clicking "Configure" or "Edit" on MQTT integrations, the route navigation was correct (`/dashboard/integrations/mqtt/new` or `/dashboard/integrations/mqtt/{id}`), but `MqttConfigDialog` always rendered as a modal Dialog component, appearing as an overlay on top of the page layout rather than inline content.

## Solution

### 1. Added `mode` Prop to MqttConfigDialog

**File:** `src/components/integrations/MqttConfigDialog.tsx`

Added a `mode` prop with two options:
- `'dialog'` - Renders as modal overlay (default for backward compatibility)
- `'page'` - Renders as inline page content

**Changes:**
```typescript
interface Props {
  mode?: 'dialog' | 'page' // NEW
  open: boolean
  onOpenChange: (open: boolean) => void
  integrationId?: string
  organizationId: string
  onSaved?: (integrationId?: string) => void
}
```

### 2. Extracted Content into Reusable Function

Created `renderContent()` function containing all tabs, forms, and buttons. This content is reused in both modes:

```typescript
const renderContent = () => (
  <>
    <Tabs defaultValue="general" className="w-full">
      {/* All tab content */}
    </Tabs>
    <div className="flex justify-end gap-2 pt-4 border-t">
      {/* Action buttons */}
    </div>
  </>
)
```

### 3. Conditional Rendering Based on Mode

**Dialog Mode** (existing behavior):
```typescript
if (mode === 'dialog') {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>MQTT Broker Integration</DialogTitle>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  )
}
```

**Page Mode** (new inline rendering):
```typescript
if (mode === 'page') {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">MQTT Broker Integration</h2>
          <p className="text-muted-foreground">Configure your MQTT broker connection</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  )
}
```

### 4. Updated MqttPageClient to Use Page Mode

**File:** `src/app/dashboard/integrations/mqtt/[id]/MqttPageClient.tsx`

Changed from:
```typescript
<MqttConfigDialog
  open={true}
  onOpenChange={(open) => { if (!open) handleClose() }}
  // ...
/>
```

To:
```typescript
<MqttConfigDialog
  mode="page"  // ← NEW: Renders inline, not as modal
  open={true}
  onOpenChange={(open) => { if (!open) handleClose() }}
  // ...
/>
```

## Integration Categorization

Also added `category` field to `INTEGRATION_TYPES` for better organization:

- **Device Integrations** (`category: 'device'`):
  - 🌐 Golioth
  - ☁️ AWS IoT Core
  - 🔵 Azure IoT Hub
  - 📡 MQTT Broker
  - 🚀 NetNeural Hub

- **Notifications** (`category: 'notification'`):
  - 📧 Email (SMTP)
  - 💬 Slack

- **Custom** (`category: 'custom'`):
  - 🔗 Custom Webhook

The "Add Integration" dropdown now displays these categories with visual separators for clarity.

## Files Modified

1. **src/components/integrations/MqttConfigDialog.tsx**
   - Added `mode?: 'dialog' | 'page'` prop (default: `'dialog'`)
   - Extracted content into `renderContent()` function
   - Conditional rendering: Dialog wrapper vs inline Card wrapper
   - Fixed TypeScript error in response data typing

2. **src/app/dashboard/integrations/mqtt/[id]/MqttPageClient.tsx**
   - Added `mode="page"` prop to MqttConfigDialog
   - Updated comment from "fullscreen overlay" to "inline, not as modal overlay"

3. **src/app/dashboard/settings/components/IntegrationsTab.tsx**
   - Added `category` field to all INTEGRATION_TYPES entries
   - Updated SelectContent to group integrations by category
   - Added visual separators with emoji headers (📱 Device, 🔔 Notifications, ⚙️ Custom)

4. **src/components/integrations/MqttBrokerConfig.old.tsx**
   - Renamed to `.tsx.bak` to exclude from build (had syntax error)

## Build Status

✅ **Next.js build successful** (no errors, only ESLint warnings for `any` types)

Routes generated:
```
├ ● /dashboard/integrations/mqtt/[id]      857 B         343 kB        
├   └ /dashboard/integrations/mqtt/new
```

## Testing Checklist

- [ ] Navigate to `/dashboard/integrations` → "Add Integration" → "MQTT Broker"
- [ ] Verify dropdown shows categorized integration types (Device, Notifications, Custom)
- [ ] Click "Continue to Configuration" → Should route to `/dashboard/integrations/mqtt/new`
- [ ] Verify MQTT config renders **inline** (not as modal overlay)
- [ ] Select "Hosted Broker" → Fill name → Save
- [ ] Should see success toast and navigate back to integrations list
- [ ] Edit existing MQTT integration → Verify opens as page (not modal)
- [ ] Compare to Golioth integration (should have similar page-based UX)
- [ ] Test "Cancel" button → Should navigate back to integrations list

## Next Steps

1. **Deploy MQTT migrations** (if not already deployed):
   ```bash
   npx supabase db push --linked
   ```

2. **Test other integration types**: Verify email, slack, webhook, etc. still work correctly in `/dashboard/integrations/view` route

3. **Consider:** Should other integrations also use dedicated page routes instead of the generic `/view` route?

4. **Documentation:** Update user docs to explain integration categories

## Backward Compatibility

✅ **Preserved**: All existing uses of `MqttConfigDialog` without the `mode` prop will default to `'dialog'` mode (modal overlay), maintaining backward compatibility.

## Architecture Notes

This implementation follows the **server component + client wrapper** pattern for Next.js 15 static export:

- `page.tsx` - Server component with `generateStaticParams()`
- `MqttPageClient.tsx` - Client component with `'use client'` and router logic
- `MqttConfigDialog.tsx` - Reusable component with dual rendering modes

This pattern can be applied to other integrations when converting from modal to page-based workflows.
