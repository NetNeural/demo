/**
 * Customer Data Export API - Edge Function (#383)
 *
 * Routes (all require Authorization: Bearer nn_live_... API key):
 *   GET /functions/v1/export/telemetry     - Paginated telemetry data (#385)
 *   GET /functions/v1/export/devices       - All devices with status (#386)
 *   GET /functions/v1/export/devices/:id   - Single device detail (#386)
 *   GET /functions/v1/export/alerts        - Alerts with severity/status (#387)
 *
 * Features:
 *   - API key auth (Bearer nn_live_...) via shared middleware
 *   - Org-scoped: all queries filtered by authenticated org
 *   - Keyset pagination with cursor (timestamp,id) for telemetry
 *   - CSV export via Accept: text/csv header
 *   - Rate limit header responses (X-RateLimit-*)
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  validateApiKey,
  ApiKeyAuthError,
  apiKeyCorsHeaders,
} from '../_shared/api-key-auth.ts'

const corsHeaders = apiKeyCorsHeaders

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'GET') {
    return jsonError('Method not allowed', 405)
  }

  const url = new URL(req.url)
  // Path will be like /export/telemetry or /export/devices or /export/devices/:id or /export/alerts
  const pathParts = url.pathname.replace(/^\/+/, '').split('/')
  // Find the segment after 'export'
  const exportIdx = pathParts.findIndex(p => p === 'export')
  const resource = exportIdx >= 0 ? pathParts[exportIdx + 1] : pathParts[pathParts.length - 1]
  const resourceId = exportIdx >= 0 ? pathParts[exportIdx + 2] : undefined
  const subResource = exportIdx >= 0 ? pathParts[exportIdx + 3] : undefined

  try {
    // Authenticate via API key
    const apiKeyCtx = await validateApiKey(req, 'read')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const orgId = apiKeyCtx.organizationId
    const wantsCsv = req.headers.get('Accept') === 'text/csv'

    // =========================================================================
    // Route: GET /export/telemetry
    // =========================================================================
    if (resource === 'telemetry') {
      const params = url.searchParams
      const deviceId = params.get('device_id')
      const field = params.get('field')
      const from = params.get('from')
      const to = params.get('to') || new Date().toISOString()
      const fromDefault = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const locationId = params.get('location_id')
      const departmentId = params.get('department_id')
      const sortOrder = params.get('sort') === 'asc'
      const limit = Math.min(parseInt(params.get('limit') || '100'), 1000)
      const cursor = params.get('cursor') // base64-encoded keyset cursor

      // Decode cursor if present
      let cursorTimestamp: string | null = null
      let cursorId: string | null = null
      if (cursor) {
        try {
          const decoded = JSON.parse(atob(cursor))
          cursorTimestamp = decoded.t
          cursorId = decoded.id
        } catch {
          return jsonError('Invalid cursor', 400)
        }
      }

      // Build query — join device_data with devices to confirm org scope
      let query = supabase
        .from('device_data')
        .select(`
          id,
          device_id,
          sensor_type,
          value,
          unit,
          quality,
          timestamp,
          devices!inner(name, organization_id, location_id, department_id)
        `, { count: 'exact' })
        .eq('devices.organization_id', orgId)
        .gte('timestamp', from || fromDefault)
        .lte('timestamp', to)
        .limit(limit + 1)

      if (deviceId) {
        const ids = deviceId.split(',').map(s => s.trim())
        query = ids.length === 1
          ? query.eq('device_id', ids[0])
          : query.in('device_id', ids)
      }
      if (field) query = query.eq('sensor_type', field)
      if (locationId) query = query.eq('devices.location_id', locationId)
      if (departmentId) query = query.eq('devices.department_id', departmentId)

      // Keyset pagination cursor
      if (cursorTimestamp && cursorId) {
        if (sortOrder) {
          query = query.or(`timestamp.gt.${cursorTimestamp},and(timestamp.eq.${cursorTimestamp},id.gt.${cursorId})`)
        } else {
          query = query.or(`timestamp.lt.${cursorTimestamp},and(timestamp.eq.${cursorTimestamp},id.lt.${cursorId})`)
        }
      }

      query = sortOrder
        ? query.order('timestamp', { ascending: true }).order('id', { ascending: true })
        : query.order('timestamp', { ascending: false }).order('id', { ascending: false })

      const { data, count, error } = await query
      if (error) throw error

      const hasMore = (data?.length ?? 0) > limit
      const records = (data ?? []).slice(0, limit).map((row: Record<string, unknown>) => ({
        id: row.id,
        device_id: row.device_id,
        device_name: (row.devices as { name: string })?.name,
        timestamp: row.timestamp,
        field: row.sensor_type,
        value: row.value,
        unit: row.unit,
        quality: row.quality,
      }))

      let nextCursor: string | null = null
      if (hasMore && records.length > 0) {
        const last = records[records.length - 1]
        nextCursor = btoa(JSON.stringify({ t: last.timestamp, id: last.id }))
      }

      if (wantsCsv) {
        const csv = toCsv(records, ['id', 'device_id', 'device_name', 'timestamp', 'field', 'value', 'unit', 'quality'])
        return new Response(csv, {
          headers: { ...corsHeaders, 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="telemetry.csv"' },
        })
      }

      return jsonOk({
        data: records,
        pagination: { total: count ?? 0, limit, next_cursor: nextCursor },
      }, apiKeyCtx.rateLimitPerMinute)
    }

    // =========================================================================
    // Route: GET /export/devices  or  GET /export/devices/:id[/status-history]
    // =========================================================================
    if (resource === 'devices') {
      const params = url.searchParams

      // Single device detail
      if (resourceId && subResource !== 'status-history') {
        const { data: device, error } = await supabase
          .from('devices')
          .select(`
            id, name, device_type, model, serial_number, status, last_seen,
            battery_level, signal_strength, firmware_version,
            metadata, created_at, updated_at,
            locations(name),
            departments(name)
          `)
          .eq('id', resourceId)
          .eq('organization_id', orgId)
          .maybeSingle()

        if (error) throw error
        if (!device) return jsonError('Device not found', 404)

        return jsonOk({ data: formatDevice(device) }, apiKeyCtx.rateLimitPerMinute)
      }

      // Status history for a single device
      if (resourceId && subResource === 'status-history') {
        const limit = Math.min(parseInt(params.get('limit') || '100'), 1000)
        const cursor = params.get('cursor')

        let query = supabase
          .from('device_data')
          .select('id, sensor_type, value, unit, timestamp, devices!inner(organization_id)', { count: 'exact' })
          .eq('devices.organization_id', orgId)
          .eq('device_id', resourceId)
          .in('sensor_type', ['connection_state', 'status', 'online'])
          .order('timestamp', { ascending: false })
          .limit(limit + 1)

        if (cursor) {
          try { query = query.lt('timestamp', JSON.parse(atob(cursor)).t) } catch { /* invalid cursor */ }
        }

        const { data, count, error } = await query
        if (error) throw error

        const records = (data ?? []).slice(0, limit)
        const hasMore = (data?.length ?? 0) > limit
        const nextCursor = hasMore && records.length > 0
          ? btoa(JSON.stringify({ t: records[records.length - 1].timestamp }))
          : null

        return jsonOk({ data: records, pagination: { total: count ?? 0, limit, next_cursor: nextCursor } }, apiKeyCtx.rateLimitPerMinute)
      }

      // Device list
      const status = params.get('status')
      const locationId = params.get('location_id')
      const departmentId = params.get('department_id')
      const deviceType = params.get('device_type')
      const limit = Math.min(parseInt(params.get('limit') || '100'), 1000)
      const cursor = params.get('cursor')

      let query = supabase
        .from('devices')
        .select(`
          id, name, device_type, model, serial_number, status, last_seen,
          battery_level, signal_strength, firmware_version,
          metadata, created_at, updated_at,
          locations(name),
          departments(name)
        `, { count: 'exact' })
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(limit + 1)

      if (status) query = query.eq('status', status)
      if (locationId) query = query.eq('location_id', locationId)
      if (departmentId) query = query.eq('department_id', departmentId)
      if (deviceType) query = query.eq('device_type', deviceType)
      if (cursor) {
        try { query = query.lt('created_at', JSON.parse(atob(cursor)).t) } catch { /* invalid */ }
      }

      const { data, count, error } = await query
      if (error) throw error

      const records = (data ?? []).slice(0, limit).map(formatDevice)
      const hasMore = (data?.length ?? 0) > limit
      const nextCursor = hasMore && records.length > 0
        ? btoa(JSON.stringify({ t: records[records.length - 1].created_at }))
        : null

      if (wantsCsv) {
        const csv = toCsv(records, ['id', 'name', 'device_type', 'status', 'last_seen', 'location', 'firmware_version'])
        return new Response(csv, {
          headers: { ...corsHeaders, 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="devices.csv"' },
        })
      }

      return jsonOk({ data: records, pagination: { total: count ?? 0, limit, next_cursor: nextCursor } }, apiKeyCtx.rateLimitPerMinute)
    }

    // =========================================================================
    // Route: GET /export/alerts
    // =========================================================================
    if (resource === 'alerts') {
      const params = url.searchParams
      const severity = params.get('severity')
      const isResolved = params.get('resolved')
      const deviceId = params.get('device_id')
      const alertType = params.get('type')
      const from = params.get('from')
      const to = params.get('to')
      const limit = Math.min(parseInt(params.get('limit') || '100'), 1000)
      const cursor = params.get('cursor')

      let query = supabase
        .from('alerts')
        .select(`
          id, alert_type, severity, title, message, is_resolved,
          resolved_at, created_at, updated_at,
          device_id,
          devices(name)
        `, { count: 'exact' })
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(limit + 1)

      if (severity) query = query.eq('severity', severity)
      if (isResolved !== null && isResolved !== undefined)
        query = query.eq('is_resolved', isResolved === 'true')
      if (deviceId) query = query.eq('device_id', deviceId)
      if (alertType) query = query.eq('alert_type', alertType)
      if (from) query = query.gte('created_at', from)
      if (to) query = query.lte('created_at', to)
      if (cursor) {
        try { query = query.lt('created_at', JSON.parse(atob(cursor)).t) } catch { /* invalid */ }
      }

      const { data, count, error } = await query
      if (error) throw error

      const records = (data ?? []).slice(0, limit).map((a: Record<string, unknown>) => ({
        id: a.id,
        type: a.alert_type,
        severity: a.severity,
        title: a.title,
        message: a.message,
        device_id: a.device_id,
        device_name: (a.devices as { name: string } | null)?.name ?? null,
        is_resolved: a.is_resolved,
        resolved_at: a.resolved_at,
        created_at: a.created_at,
      }))
      const hasMore = (data?.length ?? 0) > limit
      const nextCursor = hasMore && records.length > 0
        ? btoa(JSON.stringify({ t: records[records.length - 1].created_at }))
        : null

      if (wantsCsv) {
        const csv = toCsv(records, ['id', 'type', 'severity', 'title', 'device_name', 'is_resolved', 'created_at'])
        return new Response(csv, {
          headers: { ...corsHeaders, 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="alerts.csv"' },
        })
      }

      return jsonOk({ data: records, pagination: { total: count ?? 0, limit, next_cursor: nextCursor } }, apiKeyCtx.rateLimitPerMinute)
    }

    return jsonError(`Unknown resource: ${resource}. Available: telemetry, devices, alerts`, 404)

  } catch (err) {
    if (err instanceof ApiKeyAuthError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: err.statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    console.error('[export] Unhandled error:', err)
    return jsonError('Internal server error', 500)
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDevice(d: Record<string, unknown>) {
  return {
    id: d.id,
    name: d.name,
    device_type: d.device_type,
    model: d.model,
    serial_number: d.serial_number,
    status: d.status,
    last_seen: d.last_seen,
    battery_level: d.battery_level,
    signal_strength: d.signal_strength,
    firmware_version: d.firmware_version,
    location: (d.locations as { name: string } | null)?.name ?? null,
    department: (d.departments as { name: string } | null)?.name ?? null,
    metadata: d.metadata,
    created_at: d.created_at,
  }
}

function jsonOk(body: unknown, rateLimitPerMinute?: number): Response {
  const headers: Record<string, string> = {
    ...corsHeaders,
    'Content-Type': 'application/json',
  }
  if (rateLimitPerMinute && rateLimitPerMinute > 0) {
    headers['X-RateLimit-Limit'] = String(rateLimitPerMinute)
  }
  return new Response(JSON.stringify(body), { status: 200, headers })
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function toCsv(rows: Record<string, unknown>[], fields: string[]): string {
  const header = fields.join(',')
  const lines = rows.map(row =>
    fields.map(f => {
      const v = row[f]
      if (v === null || v === undefined) return ''
      const str = String(v)
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str
    }).join(',')
  )
  return [header, ...lines].join('\n')
}
