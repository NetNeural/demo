import {
  createEdgeFunction,
  createSuccessResponse,
  DatabaseError,
} from '../_shared/request-handler.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getUserContext } from '../_shared/auth.ts'
import {
  validateBody,
  alertRuleSchemas,
  ValidationError,
} from '../_shared/validation.ts'

// ─── Org Membership Check ────────────────────────────────────────────
// Verifies the user belongs to the target organization (or is super_admin).
async function verifyOrgAccess(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  organizationId: string,
  isSuperAdmin: boolean
): Promise<void> {
  if (isSuperAdmin) return

  const { data: membership } = await supabaseAdmin
    .from('organization_members')
    .select('id, role')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .limit(1)
    .maybeSingle()

  if (!membership) {
    throw new DatabaseError(
      'You do not have access to this organization',
      403
    )
  }

  // Only admin/owner roles can manage alert rules
  if (!['owner', 'admin'].includes(membership.role)) {
    throw new DatabaseError(
      'You do not have permission to manage alert rules',
      403
    )
  }
}

export default createEdgeFunction(
  async ({ req }) => {
    // Authenticate user via JWT
    const userContext = await getUserContext(req)

    // Service-role client bypasses RLS — authorization enforced in function logic
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const url = new URL(req.url)
    const pathSegments = url.pathname.split('/').filter(Boolean)
    // Last segment is the ruleId (if not 'alert-rules' itself)
    const lastSegment = pathSegments[pathSegments.length - 1]
    const ruleId = lastSegment !== 'alert-rules' ? lastSegment : null

    // ─── GET /alert-rules — List all rules for organization ──────────
    if (req.method === 'GET' && !ruleId) {
      const organizationId = url.searchParams.get('organization_id')
      const ruleType = url.searchParams.get('rule_type')
      const enabled = url.searchParams.get('enabled')

      if (!organizationId) {
        throw new Error('organization_id is required')
      }

      await verifyOrgAccess(
        supabaseAdmin,
        userContext.userId,
        organizationId,
        userContext.isSuperAdmin
      )

      let query = supabaseAdmin
        .from('alert_rules')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      if (ruleType) {
        query = query.eq('rule_type', ruleType)
      }

      if (enabled !== null && enabled !== undefined) {
        query = query.eq('enabled', enabled === 'true')
      }

      const { data, error } = await query

      if (error) {
        console.error('[alert-rules] List error:', error)
        throw new DatabaseError(error.message)
      }

      return createSuccessResponse(data)
    }

    // ─── GET /alert-rules/:id — Get single rule ─────────────────────
    if (req.method === 'GET' && ruleId) {
      const { data, error } = await supabaseAdmin
        .from('alert_rules')
        .select('*')
        .eq('id', ruleId)
        .single()

      if (error) {
        console.error('[alert-rules] Get error:', error)
        throw new DatabaseError('Rule not found', 404)
      }

      // Verify user has access to this rule's organization
      await verifyOrgAccess(
        supabaseAdmin,
        userContext.userId,
        data.organization_id,
        userContext.isSuperAdmin
      )

      return createSuccessResponse(data)
    }

    // ─── POST /alert-rules — Create new rule ────────────────────────
    if (req.method === 'POST' && !url.pathname.includes('/duplicate')) {
      let body
      try {
        body = await validateBody(req, alertRuleSchemas.create)
      } catch (err) {
        if (err instanceof ValidationError) {
          throw new Error(`Validation failed: ${JSON.stringify(err.errors)}`)
        }
        throw err
      }

      await verifyOrgAccess(
        supabaseAdmin,
        userContext.userId,
        body.organization_id,
        userContext.isSuperAdmin
      )

      // rule_type-specific condition validation
      if (body.rule_type === 'telemetry') {
        if (
          !body.condition.metric ||
          !body.condition.operator ||
          body.condition.value === undefined
        ) {
          throw new Error(
            'Telemetry rules require metric, operator, and value'
          )
        }
      } else if (body.rule_type === 'offline') {
        if (!body.condition.offline_minutes) {
          throw new Error('Offline rules require offline_minutes')
        }
      }

      const { data, error } = await supabaseAdmin
        .from('alert_rules')
        .insert({
          ...body,
          created_by: userContext.userId,
          enabled: body.enabled ?? true,
          cooldown_minutes: body.cooldown_minutes ?? 60,
        })
        .select()
        .single()

      if (error) {
        console.error('[alert-rules] Create error:', error)
        throw new DatabaseError(error.message)
      }

      return createSuccessResponse(data, { status: 201 })
    }

    // ─── PUT /alert-rules/:id — Update rule ─────────────────────────
    if (req.method === 'PUT' && ruleId) {
      // Fetch existing rule to verify org access
      const { data: existing } = await supabaseAdmin
        .from('alert_rules')
        .select('organization_id')
        .eq('id', ruleId)
        .single()

      if (!existing) {
        throw new DatabaseError('Rule not found', 404)
      }

      await verifyOrgAccess(
        supabaseAdmin,
        userContext.userId,
        existing.organization_id,
        userContext.isSuperAdmin
      )

      const body = await req.json()

      // Remove fields that shouldn't be updated
      delete body.id
      delete body.created_by
      delete body.organization_id

      const { data, error } = await supabaseAdmin
        .from('alert_rules')
        .update({
          ...body,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ruleId)
        .select()
        .single()

      if (error) {
        console.error('[alert-rules] Update error:', error)
        throw new DatabaseError(error.message)
      }

      return createSuccessResponse(data)
    }

    // ─── DELETE /alert-rules/:id — Delete rule ──────────────────────
    if (req.method === 'DELETE' && ruleId) {
      const { data: existing } = await supabaseAdmin
        .from('alert_rules')
        .select('organization_id')
        .eq('id', ruleId)
        .single()

      if (!existing) {
        throw new DatabaseError('Rule not found', 404)
      }

      await verifyOrgAccess(
        supabaseAdmin,
        userContext.userId,
        existing.organization_id,
        userContext.isSuperAdmin
      )

      const { error } = await supabaseAdmin
        .from('alert_rules')
        .delete()
        .eq('id', ruleId)

      if (error) {
        console.error('[alert-rules] Delete error:', error)
        throw new DatabaseError(error.message)
      }

      return createSuccessResponse({ deleted: true })
    }

    // ─── PATCH /alert-rules/:id/toggle — Toggle enabled status ──────
    if (req.method === 'PATCH' && ruleId && url.pathname.includes('/toggle')) {
      const { data: existing } = await supabaseAdmin
        .from('alert_rules')
        .select('organization_id')
        .eq('id', ruleId)
        .single()

      if (!existing) {
        throw new DatabaseError('Rule not found', 404)
      }

      await verifyOrgAccess(
        supabaseAdmin,
        userContext.userId,
        existing.organization_id,
        userContext.isSuperAdmin
      )

      const { enabled } = await req.json()

      const { data, error } = await supabaseAdmin
        .from('alert_rules')
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq('id', ruleId)
        .select()
        .single()

      if (error) {
        console.error('[alert-rules] Toggle error:', error)
        throw new DatabaseError(error.message)
      }

      return createSuccessResponse(data)
    }

    // ─── POST /alert-rules/:id/duplicate — Duplicate rule ───────────
    if (
      req.method === 'POST' &&
      ruleId &&
      url.pathname.includes('/duplicate')
    ) {
      const { data: original, error: fetchError } = await supabaseAdmin
        .from('alert_rules')
        .select('*')
        .eq('id', ruleId)
        .single()

      if (fetchError || !original) {
        throw new DatabaseError('Rule not found', 404)
      }

      await verifyOrgAccess(
        supabaseAdmin,
        userContext.userId,
        original.organization_id,
        userContext.isSuperAdmin
      )

      const { data, error } = await supabaseAdmin
        .from('alert_rules')
        .insert({
          ...original,
          id: undefined,
          name: `${original.name} (Copy)`,
          created_by: userContext.userId,
          created_at: undefined,
          updated_at: undefined,
        })
        .select()
        .single()

      if (error) {
        console.error('[alert-rules] Duplicate error:', error)
        throw new DatabaseError(error.message)
      }

      return createSuccessResponse(data, { status: 201 })
    }

    throw new Error('Method not allowed')
  },
  { allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] }
)
