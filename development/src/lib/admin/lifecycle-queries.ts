/**
 * Customer lifecycle query helpers for Supabase (super admin)
 * Used by the /dashboard/admin/customers/[orgId] detail page (#57)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CustomerOverviewRow,
  LifecycleEvent,
  LifecycleStage,
  LifecycleTriggerType,
  TimelineEntry,
} from '@/types/billing'

// ============================================================================
// Customer detail
// ============================================================================

/** Fetch a single customer overview row by org ID */
export async function fetchCustomerDetail(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ data: CustomerOverviewRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('admin_customer_overview')
    .select('*')
    .eq('id', orgId)
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as CustomerOverviewRow, error: null }
}

// ============================================================================
// Lifecycle events
// ============================================================================

/** Fetch lifecycle events for an organization */
export async function fetchLifecycleEvents(
  supabase: SupabaseClient,
  orgId: string,
  limit: number = 50
): Promise<LifecycleEvent[]> {
  const { data, error } = await supabase
    .from('customer_lifecycle_events')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return data as LifecycleEvent[]
}

/** Insert a manual stage override */
export async function insertStageOverride(
  supabase: SupabaseClient,
  orgId: string,
  fromStage: LifecycleStage | null,
  toStage: LifecycleStage,
  reason: string,
  userId: string
): Promise<{ success: boolean; error: string | null }> {
  // 1. Insert lifecycle event
  const { error: eventError } = await supabase
    .from('customer_lifecycle_events')
    .insert({
      organization_id: orgId,
      from_stage: fromStage,
      to_stage: toStage,
      trigger_type: 'manual' as LifecycleTriggerType,
      trigger_reason: reason,
      created_by: userId,
      metadata: { manual_override: true },
    })

  if (eventError) return { success: false, error: eventError.message }

  // 2. Update organization lifecycle stage
  const { error: updateError } = await supabase
    .from('organizations')
    .update({
      lifecycle_stage: toStage,
      lifecycle_stage_changed_at: new Date().toISOString(),
    })
    .eq('id', orgId)

  if (updateError) return { success: false, error: updateError.message }

  return { success: true, error: null }
}

// ============================================================================
// Activity timeline (unified feed)
// ============================================================================

/** Build a unified activity timeline from multiple data sources */
export async function fetchActivityTimeline(
  supabase: SupabaseClient,
  orgId: string,
  limit: number = 50
): Promise<TimelineEntry[]> {
  const entries: TimelineEntry[] = []

  // Parallel queries for different activity types
  const [lifecycleResult, devicesResult, invoicesResult, membersResult, alertsResult, loginResult] = await Promise.all([
    // Lifecycle events
    supabase
      .from('customer_lifecycle_events')
      .select('id, from_stage, to_stage, trigger_type, trigger_reason, created_at, metadata')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit),

    // Device additions/changes (recent)
    supabase
      .from('devices')
      .select('id, name, status, created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(20),

    // Invoices
    supabase
      .from('invoices')
      .select('id, amount_cents, currency, status, created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(20),

    // Member joins
    supabase
      .from('organization_members')
      .select('id, user_id, role, joined_at')
      .eq('organization_id', orgId)
      .order('joined_at', { ascending: false })
      .limit(20),

    // Critical/high alerts
    supabase
      .from('alerts')
      .select('id, title, severity, is_resolved, created_at')
      .eq('organization_id', orgId)
      .in('severity', ['critical', 'high'])
      .order('created_at', { ascending: false })
      .limit(20),

    // Recent logins
    supabase
      .from('user_audit_log')
      .select('id, user_email, action_type, created_at')
      .eq('organization_id', orgId)
      .eq('action_category', 'authentication')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  // Map lifecycle events
  if (lifecycleResult.data) {
    for (const e of lifecycleResult.data) {
      entries.push({
        id: e.id,
        type: 'lifecycle',
        title: `Stage changed: ${e.from_stage || 'initial'} → ${e.to_stage}`,
        description: e.trigger_reason || `${e.trigger_type} transition`,
        timestamp: e.created_at,
        icon: 'lifecycle',
      })
    }
  }

  // Map device additions
  if (devicesResult.data) {
    for (const d of devicesResult.data) {
      entries.push({
        id: d.id,
        type: 'device',
        title: `Device added: ${d.name}`,
        description: `Status: ${d.status}`,
        timestamp: d.created_at,
        icon: 'device',
      })
    }
  }

  // Map invoices
  if (invoicesResult.data) {
    for (const inv of invoicesResult.data) {
      const amount = (inv.amount_cents / 100).toLocaleString('en-US', {
        style: 'currency',
        currency: inv.currency,
      })
      entries.push({
        id: inv.id,
        type: 'payment',
        title: `Invoice ${inv.status}: ${amount}`,
        description: null,
        timestamp: inv.created_at,
        icon: 'payment',
      })
    }
  }

  // Map member joins
  if (membersResult.data) {
    for (const m of membersResult.data) {
      entries.push({
        id: m.id,
        type: 'member',
        title: `Member joined as ${m.role}`,
        description: null,
        timestamp: m.joined_at,
        icon: 'member',
      })
    }
  }

  // Map alerts
  if (alertsResult.data) {
    for (const a of alertsResult.data) {
      entries.push({
        id: a.id,
        type: 'alert',
        title: `${a.severity} alert: ${a.title}`,
        description: a.is_resolved ? 'Resolved' : 'Open',
        timestamp: a.created_at,
        icon: 'alert',
      })
    }
  }

  // Map logins
  if (loginResult.data) {
    for (const l of loginResult.data) {
      entries.push({
        id: l.id,
        type: 'login',
        title: `User login: ${l.user_email || 'unknown'}`,
        description: l.action_type,
        timestamp: l.created_at,
        icon: 'login',
      })
    }
  }

  // Sort all entries by timestamp descending
  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return entries.slice(0, limit)
}
