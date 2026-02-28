# Integration Sync Tab - Customization Examples

The `IntegrationSyncTab` component is **100% reusable** with powerful customization options.

## Basic Usage (Default - All Options)

```tsx
<IntegrationSyncTab
  integrationId={integrationId}
  organizationId={organizationId}
  integrationType="golioth"
  integrationName={config.name}
/>
```

## Customization Examples

### 1. MQTT - Import Only with Custom Help Text

MQTT is typically for receiving data, so we only show import direction:

```tsx
<IntegrationSyncTab
  integrationId={integrationId}
  organizationId={organizationId}
  integrationType="mqtt"
  integrationName={config.name}
  availableDirections={['import']}
  defaultOptions={{ direction: 'import' }}
  helpText="MQTT sync imports device status from subscribed topics"
/>
```

### 2. Email - No Sync Needed

Email integrations don't sync devices, so we can skip the sync tab entirely or show a message:

```tsx
// Don't render sync tab, or create a custom message component
```

### 3. Webhook - Export Only

Webhooks send data out, so only export makes sense:

```tsx
<IntegrationSyncTab
  integrationId={integrationId}
  organizationId={organizationId}
  integrationType="webhook"
  integrationName={config.name}
  availableDirections={['export']}
  defaultOptions={{ direction: 'export' }}
  showSyncMetadata={false} // Webhooks don't sync metadata
  helpText="Webhook sync sends device events to your endpoint"
/>
```

### 4. Slack - Notification Only (No Device Sync)

```tsx
<IntegrationSyncTab
  integrationId={integrationId}
  organizationId={organizationId}
  integrationType="slack"
  integrationName={config.name}
  availableDirections={['export']}
  showCreateMissing={false}
  showUpdateExisting={false}
  showSyncStatus={false}
  showSyncMetadata={false}
  helpText="Slack sync sends notifications about device events"
/>
```

### 5. AWS IoT / Azure IoT / Google IoT - Full Bidirectional

These support full bidirectional sync:

```tsx
<IntegrationSyncTab
  integrationId={integrationId}
  organizationId={organizationId}
  integrationType="aws_iot"
  integrationName={config.name}
  // All defaults are perfect - full bidirectional sync
/>
```

### 6. Custom Options UI - Advanced

For complex integrations that need completely custom sync options:

```tsx
<IntegrationSyncTab
  integrationId={integrationId}
  organizationId={organizationId}
  integrationType="custom"
  integrationName={config.name}
  customOptionsRenderer={(options, setOptions, syncing) => (
    <div className="space-y-4">
      {/* Fully custom UI here */}
      <div className="space-y-2">
        <Label>Custom Sync Mode</Label>
        <Select
          value={options.direction}
          onValueChange={(value) =>
            setOptions({ ...options, direction: value })
          }
          disabled={syncing}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="import">Full Import</SelectItem>
            <SelectItem value="export">Delta Export</SelectItem>
            <SelectItem value="bidirectional">Smart Sync</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Add any custom fields specific to this integration */}
      <Input placeholder="Custom field..." disabled={syncing} />
    </div>
  )}
/>
```

## Backend Customization

Each integration type can have custom sync logic in `supabase/functions/integrations/index.ts`:

```typescript
switch (typedIntegration.integration_type) {
  case 'golioth':
    // Golioth-specific sync logic
    // - Uses GoliothClient
    // - Syncs device twins
    // - Updates firmware status
    break

  case 'mqtt':
    // MQTT-specific sync logic
    // - Imports from MQTT topics
    // - No bidirectional (publish only)
    break

  case 'aws_iot':
    // AWS IoT-specific sync logic
    // - Uses AwsIotClient
    // - Syncs thing shadows
    // - Handles certificates
    break

  case 'webhook':
    // Webhook doesn't sync devices
    // Maybe trigger test webhook calls?
    throw new DatabaseError('Sync not applicable for webhooks', 501)

  default:
    throw new DatabaseError(`Sync not implemented for ${type}`, 501)
}
```

## Props Reference

| Prop                    | Type                 | Default                                 | Description                       |
| ----------------------- | -------------------- | --------------------------------------- | --------------------------------- |
| `integrationId`         | string               | **required**                            | Integration ID                    |
| `organizationId`        | string               | **required**                            | Organization ID                   |
| `integrationType`       | string               | **required**                            | Type for logging                  |
| `integrationName`       | string               | **required**                            | Display name                      |
| `defaultOptions`        | Partial<SyncOptions> | `{}`                                    | Default sync option values        |
| `availableDirections`   | Array                | `['import', 'export', 'bidirectional']` | Which directions to show          |
| `showCreateMissing`     | boolean              | `true`                                  | Show "Create Missing" toggle      |
| `showUpdateExisting`    | boolean              | `true`                                  | Show "Update Existing" toggle     |
| `showSyncStatus`        | boolean              | `true`                                  | Show "Sync Status" toggle         |
| `showSyncMetadata`      | boolean              | `true`                                  | Show "Sync Metadata" toggle       |
| `showDryRun`            | boolean              | `true`                                  | Show "Dry Run" toggle             |
| `showDeviceLimit`       | boolean              | `true`                                  | Show device limit input           |
| `customOptionsRenderer` | function             | `undefined`                             | Completely custom options UI      |
| `helpText`              | string               | `undefined`                             | Help text shown in options header |

## Benefits

✅ **Single component** - One codebase to maintain
✅ **Flexible** - Each integration customizes only what it needs
✅ **Consistent UX** - Same look and feel across all integrations
✅ **Terminal output** - Real-time sync visibility for all types
✅ **Backend agnostic** - Backend handles integration-specific logic
✅ **Type-safe** - Full TypeScript support with customization

## Migration Guide

When adding sync to a new integration dialog:

1. Import the component:

```tsx
import { IntegrationSyncTab } from './IntegrationSyncTab'
```

2. Add the tab to TabsList:

```tsx
<TabsTrigger value="sync" disabled={!integrationId}>
  Run Sync
</TabsTrigger>
```

3. Add the tab content:

```tsx
{
  integrationId && (
    <TabsContent value="sync" className="space-y-4">
      <IntegrationSyncTab
        integrationId={integrationId}
        organizationId={organizationId}
        integrationType="your_type"
        integrationName={config.name}
        // Add customization props as needed
      />
    </TabsContent>
  )
}
```

That's it! 🎉
