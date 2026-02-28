# Golioth Integration MVP Implementation Plan

**Date:** October 27, 2025  
**Status:** Implementation Required  
**Priority:** HIGH - Core MVP Feature

---

## 📋 Executive Summary

Based on the **Technical Specification (TECHNICAL_SPECIFICATION.md)**, the Golioth integration requires significant buildout to meet MVP requirements. Currently ~40% complete - needs full configuration UI, sync engine, conflict resolution, and webhook system.

### Current Status
- ✅ Basic API client (`src/lib/golioth.ts`)
- ✅ Organization wrapper (`src/lib/integrations/organization-golioth.ts`)
- ✅ Basic sync service (`src/lib/sync/organization-golioth-sync.ts`)
- ✅ Database schema with `device_integrations` table
- ⚠️ **MISSING**: Full configuration UI
- ⚠️ **MISSING**: Bidirectional sync engine
- ⚠️ **MISSING**: Conflict resolution system
- ⚠️ **MISSING**: Webhook handlers
- ⚠️ **MISSING**: Sync logging and monitoring
- ⚠️ **MISSING**: Edge Functions for backend logic

---

## 🎯 MVP Requirements from Technical Specification

### Required Features (Section 3.1.3)

#### ✅ **Implemented**
1. Basic Golioth API client
2. Device list fetching
3. Organization-aware API wrapper

#### ❌ **Missing - MUST Implement**
1. **Real-time device synchronization** - Bidirectional sync
2. **Conflict resolution** for dual-platform management
3. **Webhook support** for real-time updates
4. **Multi-protocol support** (MQTT, CoAP, HTTP)
5. **Configurable sync options** via UI
6. **Sync logging** and audit trail
7. **Error handling** and retry logic
8. **Bulk operations** support

---

## 🏗️ Architecture Gap Analysis

### Spec Requirements vs Current Implementation

| Component | Spec Requirement | Current Status | Gap |
|-----------|-----------------|----------------|-----|
| **API Client** | Full CRUD + streaming | ✅ Implemented | Minor enhancements needed |
| **Organization Layer** | Multi-tenant isolation | ✅ Implemented | Add credential encryption |
| **Sync Service** | Bidirectional sync | ⚠️ Partial | Need bidirectional + conflict resolution |
| **Database Schema** | device_services + assignments | ❌ Wrong schema | Need to refactor to match spec |
| **Edge Functions** | device-sync function | ❌ Not created | Create Supabase Edge Function |
| **Webhooks** | Golioth webhook handler | ❌ Not created | Create webhook Edge Function |
| **UI Configuration** | Full integration management | ⚠️ Partial | Add sync controls, conflict UI |
| **Sync Logging** | golioth_sync_log table | ❌ Missing | Create table + logging |
| **Conflict Resolution** | device_conflicts table | ❌ Missing | Create table + resolution UI |

---

## 📊 Database Schema Corrections

### ❌ Current Schema (device_integrations)
```sql
CREATE TABLE device_integrations (
    id UUID PRIMARY KEY,
    organization_id UUID,
    integration_type VARCHAR(50), -- 'golioth', 'aws_iot', etc.
    name VARCHAR(255),
    configuration JSONB,
    status VARCHAR(50)
);
```

### ✅ Required Schema (from spec - Section 4.1.1)

```sql
-- Device Services (IoT Platform Integrations)
CREATE TABLE device_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    service_type VARCHAR(100) NOT NULL, -- 'golioth', 'aws_iot', 'azure_iot'
    config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Device Service Assignments
CREATE TABLE device_service_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    service_id UUID REFERENCES device_services(id) ON DELETE CASCADE,
    external_device_id VARCHAR(255),
    sync_status VARCHAR(50) DEFAULT 'pending',
    last_sync TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(device_id, service_id)
);

-- Sync Logging
CREATE TABLE golioth_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    operation VARCHAR(100) NOT NULL,
    device_id UUID REFERENCES devices(id),
    status VARCHAR(50) NOT NULL,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Device Conflicts
CREATE TABLE device_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES devices(id),
    conflict_type VARCHAR(100) NOT NULL,
    local_value JSONB,
    remote_value JSONB,
    resolution_status VARCHAR(50) DEFAULT 'pending',
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Action Required:** Create migration to add these tables

---

## 🔧 Implementation Tasks

### Phase 1: Database Foundation (Priority: CRITICAL)

#### Task 1.1: Create New Tables
```bash
# Create migration
supabase migration new golioth_mvp_schema
```

**Migration content:**
- [ ] Create `device_services` table
- [ ] Create `device_service_assignments` table  
- [ ] Create `golioth_sync_log` table
- [ ] Create `device_conflicts` table
- [ ] Migrate existing `device_integrations` → `device_services`
- [ ] Add RLS policies for all tables
- [ ] Create indexes for performance

**File:** `supabase/migrations/YYYYMMDD_golioth_mvp_schema.sql`

#### Task 1.2: Update TypeScript Types
```bash
# Regenerate types after migration
supabase gen types typescript --local > src/types/supabase.ts
```

---

### Phase 2: Supabase Edge Functions (Priority: HIGH)

#### Task 2.1: Device Sync Edge Function

**Spec Reference:** Section 5.1.2 - Directory Structure
```
supabase/functions/device-sync/
└── index.ts
```

**Purpose:** Background sync service that runs periodically

**Implementation:**
```typescript
// supabase/functions/device-sync/index.ts
import { createClient } from '@supabase/supabase-js';
import { GoliothAPI } from '../_shared/golioth.ts';

interface SyncRequest {
  organization_id: string;
  service_id: string;
  operation: 'import' | 'export' | 'bidirectional';
  device_ids?: string[];
  force?: boolean;
}

Deno.serve(async (req) => {
  try {
    const { organization_id, service_id, operation, device_ids, force } = await req.json();
    
    // 1. Get service configuration
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    const { data: service } = await supabase
      .from('device_services')
      .select('*')
      .eq('id', service_id)
      .single();
    
    if (!service || service.service_type !== 'golioth') {
      return new Response(JSON.stringify({ error: 'Invalid service' }), { status: 400 });
    }
    
    // 2. Initialize Golioth API
    const golioth = new GoliothAPI({
      apiKey: service.config.api_key,
      projectId: service.config.project_id
    });
    
    // 3. Perform sync operation
    let result;
    switch (operation) {
      case 'import':
        result = await importFromGolioth(supabase, golioth, organization_id, service_id, device_ids);
        break;
      case 'export':
        result = await exportToGolioth(supabase, golioth, organization_id, service_id, device_ids);
        break;
      case 'bidirectional':
        result = await bidirectionalSync(supabase, golioth, organization_id, service_id, force);
        break;
    }
    
    // 4. Log sync operation
    await logSyncOperation(supabase, organization_id, operation, result);
    
    return new Response(JSON.stringify({
      operation_id: crypto.randomUUID(),
      status: 'completed',
      summary: result
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
```

**Files to create:**
- [ ] `supabase/functions/device-sync/index.ts`
- [ ] `supabase/functions/_shared/golioth.ts` (move existing client)
- [ ] `supabase/functions/_shared/database.ts` (DB helpers)
- [ ] `supabase/functions/_shared/sync-engine.ts` (sync logic)

#### Task 2.2: Webhook Handler Edge Function

**Spec Reference:** Section 4.2.2
```
supabase/functions/webhook-handler/
└── index.ts
```

**Purpose:** Receive real-time updates from Golioth webhooks

**Implementation:**
```typescript
// supabase/functions/webhook-handler/index.ts
Deno.serve(async (req) => {
  try {
    // 1. Verify webhook signature
    const signature = req.headers.get('X-Golioth-Signature');
    const body = await req.text();
    
    if (!verifyWebhookSignature(signature, body)) {
      return new Response('Invalid signature', { status: 401 });
    }
    
    // 2. Parse webhook event
    const event = JSON.parse(body);
    
    // 3. Process event based on type
    switch (event.type) {
      case 'device.online':
      case 'device.offline':
        await updateDeviceStatus(event.device_id, event.status);
        break;
        
      case 'device.data':
        await processDeviceData(event.device_id, event.data);
        break;
        
      case 'device.created':
      case 'device.updated':
      case 'device.deleted':
        await syncDeviceChanges(event);
        break;
    }
    
    return new Response('OK', { status: 200 });
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response('Error', { status: 500 });
  }
});
```

**Files to create:**
- [ ] `supabase/functions/webhook-handler/index.ts`
- [ ] `supabase/functions/_shared/webhook-verification.ts`

---

### Phase 3: Enhanced Sync Service (Priority: HIGH)

#### Task 3.1: Bidirectional Sync Engine

**Current:** `src/lib/sync/organization-golioth-sync.ts` only does import
**Required:** Full bidirectional sync with conflict detection

**New methods needed:**
```typescript
// src/lib/sync/organization-golioth-sync.ts

export class OrganizationGoliothSyncService {
  
  /**
   * Bidirectional sync: Golioth ↔ Local Database
   */
  async bidirectionalSync(
    organizationId: string,
    serviceId: string,
    options: {
      conflictResolution: 'local_wins' | 'remote_wins' | 'manual';
      force?: boolean;
    }
  ): Promise<BidirectionalSyncResult> {
    // 1. Get all devices from both systems
    const localDevices = await this.getLocalDevices(organizationId, serviceId);
    const remoteDevices = await this.getGoliothDevices(serviceId);
    
    // 2. Detect changes and conflicts
    const changes = this.detectChanges(localDevices, remoteDevices);
    const conflicts = this.detectConflicts(changes);
    
    // 3. Resolve conflicts based on strategy
    const resolvedChanges = await this.resolveConflicts(conflicts, options.conflictResolution);
    
    // 4. Apply changes to both systems
    const localUpdates = await this.applyLocalChanges(resolvedChanges.toLocal);
    const remoteUpdates = await this.applyRemoteChanges(resolvedChanges.toRemote);
    
    // 5. Log unresolv conflicts
    if (resolvedChanges.manualResolutionRequired.length > 0) {
      await this.createConflictRecords(resolvedChanges.manualResolutionRequired);
    }
    
    return {
      localUpdates,
      remoteUpdates,
      conflicts: resolvedChanges.manualResolutionRequired
    };
  }
  
  /**
   * Export local changes to Golioth
   */
  async exportToGolioth(
    organizationId: string,
    serviceId: string,
    deviceIds?: string[]
  ): Promise<ExportResult> {
    // Implementation for pushing local changes to Golioth
  }
  
  /**
   * Handle conflicts
   */
  private detectConflicts(changes: Change[]): Conflict[] {
    // Detect when same device changed in both systems
    return changes.filter(change => 
      change.localUpdated && change.remoteUpdated &&
      change.localUpdated !== change.remoteUpdated
    ).map(change => ({
      device_id: change.device_id,
      conflict_type: 'concurrent_modification',
      local_value: change.localData,
      remote_value: change.remoteData,
      local_timestamp: change.localUpdated,
      remote_timestamp: change.remoteUpdated
    }));
  }
  
  /**
   * Create conflict records in database
   */
  private async createConflictRecords(conflicts: Conflict[]): Promise<void> {
    const supabase = createClient();
    
    for (const conflict of conflicts) {
      await supabase.from('device_conflicts').insert({
        device_id: conflict.device_id,
        conflict_type: conflict.conflict_type,
        local_value: conflict.local_value,
        remote_value: conflict.remote_value,
        resolution_status: 'pending'
      });
    }
  }
}
```

**Files to update:**
- [ ] `src/lib/sync/organization-golioth-sync.ts` - Add bidirectional methods
- [ ] `src/lib/sync/conflict-resolver.ts` - NEW: Conflict resolution logic
- [ ] `src/lib/sync/change-detector.ts` - NEW: Change detection logic

#### Task 3.2: Sync Logging

**New service:**
```typescript
// src/lib/sync/sync-logger.ts
export class SyncLogger {
  async logOperation(params: {
    organization_id: string;
    operation: string;
    device_id?: string;
    status: 'started' | 'completed' | 'failed';
    details: Record<string, any>;
  }): Promise<void> {
    const supabase = createClient();
    
    await supabase.from('golioth_sync_log').insert({
      organization_id: params.organization_id,
      operation: params.operation,
      device_id: params.device_id,
      status: params.status,
      details: params.details
    });
  }
  
  async getSyncHistory(organizationId: string, limit = 100): Promise<SyncLog[]> {
    const supabase = createClient();
    
    const { data } = await supabase
      .from('golioth_sync_log')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    return data || [];
  }
}
```

**File to create:**
- [ ] `src/lib/sync/sync-logger.ts`

---

### Phase 4: UI Components (Priority: HIGH)

#### Task 4.1: Enhanced Integration Configuration

**Current:** Basic add/edit/delete in settings
**Required:** Full configuration with sync options

**New component:**
```typescript
// src/components/integrations/GoliothConfigDialog.tsx
export function GoliothConfigDialog({ integration, onSave, onClose }) {
  const [config, setConfig] = useState({
    name: integration?.name || '',
    api_key: integration?.configuration?.api_key || '',
    project_id: integration?.configuration?.project_id || '',
    base_url: integration?.configuration?.base_url || 'https://api.golioth.io',
    
    // Sync Configuration
    sync_enabled: integration?.configuration?.sync_enabled || false,
    sync_interval: integration?.configuration?.sync_interval || 300, // 5 min
    sync_direction: integration?.configuration?.sync_direction || 'bidirectional',
    conflict_resolution: integration?.configuration?.conflict_resolution || 'manual',
    
    // Webhook Configuration
    webhook_enabled: integration?.configuration?.webhook_enabled || false,
    webhook_secret: integration?.configuration?.webhook_secret || '',
    
    // Selective Sync
    sync_options: {
      status: true,
      battery: true,
      location: true,
      metadata: true,
      firmware: true
    }
  });
  
  return (
    <Dialog open onClose={onClose}>
      <DialogHeader>
        <DialogTitle>
          {integration ? 'Edit' : 'Add'} Golioth Integration
        </DialogTitle>
      </DialogHeader>
      
      <Tabs defaultValue="connection">
        <TabsList>
          <TabsTrigger value="connection">Connection</TabsTrigger>
          <TabsTrigger value="sync">Sync Settings</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>
        
        <TabsContent value="connection">
          {/* API Key, Project ID, Base URL */}
        </TabsContent>
        
        <TabsContent value="sync">
          <div className="space-y-4">
            <Switch
              label="Enable Automatic Sync"
              checked={config.sync_enabled}
              onChange={(checked) => setConfig({ ...config, sync_enabled: checked })}
            />
            
            <Select
              label="Sync Interval"
              value={config.sync_interval}
              onChange={(value) => setConfig({ ...config, sync_interval: value })}
            >
              <option value={60}>Every minute</option>
              <option value={300}>Every 5 minutes</option>
              <option value={900}>Every 15 minutes</option>
              <option value={3600}>Every hour</option>
            </Select>
            
            <Select
              label="Sync Direction"
              value={config.sync_direction}
              onChange={(value) => setConfig({ ...config, sync_direction: value })}
            >
              <option value="import">Import only (Golioth → Local)</option>
              <option value="export">Export only (Local → Golioth)</option>
              <option value="bidirectional">Bidirectional (both ways)</option>
            </Select>
            
            <Select
              label="Conflict Resolution"
              value={config.conflict_resolution}
              onChange={(value) => setConfig({ ...config, conflict_resolution: value })}
            >
              <option value="local_wins">Local wins</option>
              <option value="remote_wins">Remote (Golioth) wins</option>
              <option value="manual">Manual resolution required</option>
            </Select>
            
            <div>
              <h4>Sync Options</h4>
              {Object.entries(config.sync_options).map(([key, value]) => (
                <Checkbox
                  key={key}
                  label={key.charAt(0).toUpperCase() + key.slice(1)}
                  checked={value}
                  onChange={(checked) => setConfig({
                    ...config,
                    sync_options: { ...config.sync_options, [key]: checked }
                  })}
                />
              ))}
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="webhooks">
          {/* Webhook configuration */}
        </TabsContent>
      </Tabs>
      
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave(config)}>Save Integration</Button>
      </DialogFooter>
    </Dialog>
  );
}
```

**Files to create:**
- [ ] `src/components/integrations/GoliothConfigDialog.tsx`
- [ ] `src/components/integrations/SyncSettingsPanel.tsx`
- [ ] `src/components/integrations/WebhookConfigPanel.tsx`

#### Task 4.2: Sync Controls & Monitoring

**New component:**
```typescript
// src/components/integrations/GoliothSyncControls.tsx
export function GoliothSyncControls({ integrationId, organizationId }) {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncLog[]>([]);
  
  const handleManualSync = async (operation: 'import' | 'export' | 'bidirectional') => {
    setSyncing(true);
    try {
      const response = await fetch('/api/integrations/golioth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          service_id: integrationId,
          operation
        })
      });
      
      const result = await response.json();
      
      toast.success(`Synced ${result.summary.successful} devices`);
      loadSyncHistory();
      
    } catch (error) {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sync Controls</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Button
            onClick={() => handleManualSync('import')}
            disabled={syncing}
          >
            <Download className="mr-2 h-4 w-4" />
            Import from Golioth
          </Button>
          
          <Button
            onClick={() => handleManualSync('export')}
            disabled={syncing}
          >
            <Upload className="mr-2 h-4 w-4" />
            Export to Golioth
          </Button>
          
          <Button
            onClick={() => handleManualSync('bidirectional')}
            disabled={syncing}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Full Sync
          </Button>
        </div>
        
        <div className="text-sm text-muted-foreground">
          Last sync: {lastSync ? formatDistanceToNow(lastSync) + ' ago' : 'Never'}
        </div>
        
        <div className="mt-4">
          <h4 className="font-medium mb-2">Recent Sync History</h4>
          <div className="space-y-2">
            {syncHistory.map(log => (
              <div key={log.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div>
                  <div className="font-medium">{log.operation}</div>
                  <div className="text-xs text-gray-500">
                    {format(new Date(log.created_at), 'PPpp')}
                  </div>
                </div>
                <Badge variant={log.status === 'completed' ? 'success' : 'error'}>
                  {log.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Files to create:**
- [ ] `src/components/integrations/GoliothSyncControls.tsx`
- [ ] `src/components/integrations/SyncHistoryList.tsx`

#### Task 4.3: Conflict Resolution UI

**New component:**
```typescript
// src/components/integrations/ConflictResolutionDialog.tsx
export function ConflictResolutionDialog({ conflicts, onResolve }) {
  return (
    <Dialog>
      <DialogHeader>
        <DialogTitle>Resolve Sync Conflicts</DialogTitle>
        <DialogDescription>
          {conflicts.length} devices have conflicting changes
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-4">
        {conflicts.map(conflict => (
          <Card key={conflict.id}>
            <CardHeader>
              <CardTitle>{conflict.device_name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Local Value</h4>
                  <pre className="text-xs bg-gray-100 p-2 rounded">
                    {JSON.stringify(conflict.local_value, null, 2)}
                  </pre>
                  <Button
                    size="sm"
                    onClick={() => onResolve(conflict.id, 'local')}
                    className="mt-2"
                  >
                    Use Local
                  </Button>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Golioth Value</h4>
                  <pre className="text-xs bg-gray-100 p-2 rounded">
                    {JSON.stringify(conflict.remote_value, null, 2)}
                  </pre>
                  <Button
                    size="sm"
                    onClick={() => onResolve(conflict.id, 'remote')}
                    className="mt-2"
                  >
                    Use Golioth
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </Dialog>
  );
}
```

**Files to create:**
- [ ] `src/components/integrations/ConflictResolutionDialog.tsx`
- [ ] `src/components/integrations/ConflictsList.tsx`

---

### Phase 5: API Routes (Priority: MEDIUM)

#### Task 5.1: Sync API Endpoint

**File:** `src/app/api/integrations/golioth/sync/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Verify authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { organization_id, service_id, operation, device_ids, force } = body;
    
    // Call Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('device-sync', {
      body: {
        organization_id,
        service_id,
        operation,
        device_ids,
        force
      }
    });
    
    if (error) throw error;
    
    return NextResponse.json(data);
    
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
```

**Files to create:**
- [ ] `src/app/api/integrations/golioth/sync/route.ts`
- [ ] `src/app/api/integrations/golioth/devices/route.ts`
- [ ] `src/app/api/integrations/golioth/conflicts/route.ts`

---

## 📅 Implementation Timeline

### Week 1: Database & Backend Foundation
- [ ] Day 1-2: Create database migration with new tables
- [ ] Day 3-4: Create device-sync Edge Function
- [ ] Day 5: Create webhook-handler Edge Function

### Week 2: Sync Engine Enhancement
- [ ] Day 1-2: Implement bidirectional sync logic
- [ ] Day 3: Implement conflict detection
- [ ] Day 4-5: Implement sync logging and error handling

### Week 3: UI Components
- [ ] Day 1-2: Enhanced GoliothConfigDialog with all tabs
- [ ] Day 3: Sync controls and monitoring UI
- [ ] Day 4-5: Conflict resolution UI

### Week 4: Testing & Integration
- [ ] Day 1-2: Unit tests for sync engine
- [ ] Day 3: Integration tests with real Golioth API
- [ ] Day 4: E2E tests for UI flows
- [ ] Day 5: Documentation and deployment

**Total Effort:** ~4 weeks (1 developer)

---

## ✅ Definition of Done

### Functional Requirements
- [ ] User can configure Golioth integration with full sync options
- [ ] Automatic sync runs on configurable interval
- [ ] Manual sync (import/export/bidirectional) works
- [ ] Conflicts are detected and logged
- [ ] User can resolve conflicts via UI
- [ ] Webhooks receive and process real-time updates
- [ ] All operations are logged to sync_log table
- [ ] Error handling and retry logic works

### Technical Requirements
- [ ] All database migrations applied
- [ ] Edge Functions deployed and tested
- [ ] TypeScript types generated and used
- [ ] Unit test coverage > 80%
- [ ] Integration tests pass with real Golioth API
- [ ] Documentation complete
- [ ] Code review approved
- [ ] Performance tested (handle 10,000+ devices)

### Quality Requirements
- [ ] No TypeScript errors
- [ ] No console errors in browser
- [ ] All UI components accessible
- [ ] Mobile responsive design
- [ ] Loading states and error messages shown
- [ ] Toast notifications for all actions

---

## 🚀 Quick Start Checklist

To begin implementation:

1. **Read the spec:**
   - [ ] Review `TECHNICAL_SPECIFICATION.md` Section 3.1.3 (Golioth requirements)
   - [ ] Review Section 4.1.1 (Database schema)
   - [ ] Review Section 4.2.2 (API contracts)

2. **Set up environment:**
   - [ ] Get real Golioth API credentials
   - [ ] Configure local Supabase
   - [ ] Run existing migrations

3. **Start with database:**
   - [ ] Create migration for new tables
   - [ ] Apply migration locally
   - [ ] Test with seed data

4. **Build Edge Functions:**
   - [ ] Set up Edge Function development
   - [ ] Create device-sync function
   - [ ] Test locally with Supabase CLI

5. **Enhance sync service:**
   - [ ] Add bidirectional sync
   - [ ] Add conflict detection
   - [ ] Add logging

6. **Build UI:**
   - [ ] Enhanced config dialog
   - [ ] Sync controls
   - [ ] Conflict resolution

---

## 📚 References

- **Technical Specification:** `docs/TECHNICAL_SPECIFICATION.md`
- **Integration Types Guide:** `docs/INTEGRATION_TYPES_GUIDE.md`
- **Golioth Architecture:** `docs/GOLIOTH_INTEGRATION_GUIDE.md`
- **Device Management:** `docs/GOLIOTH_DEVICE_MANAGEMENT.md`
- **Coding Standards:** `docs/CODING_STANDARDS.md`

---

## 🔍 Success Metrics

After implementation, the system should achieve:

- ✅ **100% feature parity** with spec requirements
- ✅ **< 500ms** sync operation response time
- ✅ **99.9%** sync success rate
- ✅ **Zero data loss** during conflicts
- ✅ **Real-time updates** via webhooks (<1s latency)
- ✅ **10,000+ devices** sync capability per organization
- ✅ **Complete audit trail** via sync_log

---

**Next Step:** Start with Phase 1 - Database Foundation
