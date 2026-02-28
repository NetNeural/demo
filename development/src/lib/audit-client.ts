/**
 * Client-side Audit Logger
 * Logs user actions via Supabase RPC (log_user_action)
 * Used for client-initiated events like login, logout, navigation
 */

import { createClient } from '@/lib/supabase/client'

interface ClientAuditEntry {
  organizationId?: string
  actionCategory: string
  actionType: string
  resourceType?: string
  resourceId?: string
  resourceName?: string
  method?: string
  endpoint?: string
  changes?: Record<string, unknown>
  metadata?: Record<string, unknown>
  status?: string
  errorMessage?: string
}

/**
 * Log a user action from the client side.
 * Automatically resolves user_id and email from the current session.
 * Fire-and-forget — never blocks the calling flow.
 */
export async function logClientAction(entry: ClientAuditEntry): Promise<void> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return // No authenticated user — skip

    // Get the user's primary org if not provided
    let orgId = entry.organizationId
    if (!orgId) {
      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()
      orgId = membership?.organization_id || undefined
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).rpc('log_user_action', {
      p_user_id: user.id,
      p_user_email: user.email || null,
      p_organization_id: orgId || null,
      p_action_category: entry.actionCategory,
      p_action_type: entry.actionType,
      p_resource_type: entry.resourceType || null,
      p_resource_id: entry.resourceId || null,
      p_resource_name: entry.resourceName || null,
      p_method: entry.method || null,
      p_endpoint: entry.endpoint || null,
      p_changes: entry.changes || {},
      p_metadata: entry.metadata || {},
      p_status: entry.status || 'success',
      p_error_message: entry.errorMessage || null,
      p_ip_address: null,
      p_user_agent:
        typeof navigator !== 'undefined' ? navigator.userAgent : null,
      p_session_id: null,
    })
  } catch (error) {
    // Never throw — audit logging should not break the app
    console.error('[ClientAudit] Failed to log action:', error)
  }
}

/**
 * Convenience: Log a successful login
 */
export function auditLogin(
  userId: string,
  email: string,
  metadata?: Record<string, unknown>
): void {
  const supabase = createClient()
  // Fire-and-forget RPC (don't await in caller)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(supabase as any)
    .rpc('log_user_action', {
      p_user_id: userId,
      p_user_email: email,
      p_organization_id: null,
      p_action_category: 'authentication',
      p_action_type: 'login',
      p_resource_type: 'session',
      p_resource_id: null,
      p_resource_name: email,
      p_method: 'POST',
      p_endpoint: '/auth/login',
      p_changes: {},
      p_metadata: metadata || {},
      p_status: 'success',
      p_error_message: null,
      p_ip_address: null,
      p_user_agent:
        typeof navigator !== 'undefined' ? navigator.userAgent : null,
      p_session_id: null,
    })
    .then(() => {
      // Login recorded successfully
    })
    .catch((err: unknown) => {
      console.error('[ClientAudit] Failed to record login:', err)
    })
}

/**
 * Convenience: Log a failed login attempt
 */
export function auditLoginFailed(email: string, errorMessage: string): void {
  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(supabase as any)
    .rpc('log_user_action', {
      p_user_id: null,
      p_user_email: email,
      p_organization_id: null,
      p_action_category: 'authentication',
      p_action_type: 'login_failed',
      p_resource_type: 'session',
      p_resource_id: null,
      p_resource_name: email,
      p_method: 'POST',
      p_endpoint: '/auth/login',
      p_changes: {},
      p_metadata: {},
      p_status: 'failed',
      p_error_message: errorMessage,
      p_ip_address: null,
      p_user_agent:
        typeof navigator !== 'undefined' ? navigator.userAgent : null,
      p_session_id: null,
    })
    .then(() => {
      // Login failure recorded successfully
    })
    .catch((err: unknown) => {
      console.error('[ClientAudit] Failed to record login failure:', err)
    })
}

/**
 * Convenience: Log a logout
 */
export function auditLogout(userId: string, email: string): void {
  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(supabase as any)
    .rpc('log_user_action', {
      p_user_id: userId,
      p_user_email: email,
      p_organization_id: null,
      p_action_category: 'authentication',
      p_action_type: 'logout',
      p_resource_type: 'session',
      p_resource_id: null,
      p_resource_name: email,
      p_method: 'POST',
      p_endpoint: '/auth/logout',
      p_changes: {},
      p_metadata: {},
      p_status: 'success',
      p_error_message: null,
      p_ip_address: null,
      p_user_agent:
        typeof navigator !== 'undefined' ? navigator.userAgent : null,
      p_session_id: null,
    })
    .then(() => {
      // Logout recorded successfully
    })
    .catch((err: unknown) => {
      console.error('[ClientAudit] Failed to record logout:', err)
    })
}
