import {
  createEdgeFunction,
  createSuccessResponse,
  DatabaseError,
} from '../_shared/request-handler.ts'
import {
  getUserContext,
  resolveOrganizationId,
  getTargetOrganizationId,
  createServiceClient,
} from '../_shared/auth.ts'

export default createEdgeFunction(
  async ({ req }) => {
    // Get authenticated user context
    const userContext = await getUserContext(req)

    // Use service_role client to bypass RLS — authorization handled by resolveOrganizationId
    const supabase = createServiceClient()

    // Alias for backward compatibility with code that uses supabaseAdmin
    const supabaseAdmin = supabase

    if (req.method === 'GET') {
      const url = new URL(req.url)
      const requestedOrgId = url.searchParams.get('organization_id')

      // Determine which organization to query — supports multi-org via organization_members
      const organizationId = await resolveOrganizationId(
        userContext,
        requestedOrgId
      )

      // Bug #247: Always require an organization_id for dashboard stats.
      // Previously, super admins with no org_id got unfiltered results showing
      // ALL devices across ALL organizations, which caused wrong counts on
      // initial org selection.
      if (!organizationId) {
        if (userContext.isSuperAdmin) {
          console.warn('[dashboard-stats] Super admin request without organization_id — returning empty stats')
          return createSuccessResponse({
            totalDevices: 0,
            onlineDevices: 0,
            offlineDevices: 0,
            warningDevices: 0,
            totalAlerts: 0,
            criticalAlerts: 0,
            highAlerts: 0,
            unresolvedAlerts: 0,
            uptimePercentage: '0.0',
            systemStatus: 'healthy',
            activeAlerts: 0,
            lastUpdated: new Date().toISOString(),
          })
        }
        throw new DatabaseError('User has no organization access', 403)
      }

      // Build device query - exclude soft-deleted devices
      let deviceQuery = supabase
        .from('devices')
        .select('id, status, last_seen')
        .is('deleted_at', null)
        .eq('organization_id', organizationId)

      // Build alerts query (last 24 hours)
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      let alertsQuery = supabase
        .from('alerts')
        .select('id, severity, is_resolved')
        .gte('created_at', last24h)
        .eq('organization_id', organizationId)

      // Execute queries in parallel
      const [devicesResult, alertsResult] = await Promise.all([
        deviceQuery,
        alertsQuery,
      ])

      if (devicesResult.error) {
        console.error('Database error fetching devices:', devicesResult.error)
        throw new DatabaseError(
          `Failed to fetch devices: ${devicesResult.error.message}`
        )
      }

      if (alertsResult.error) {
        console.error('Database error fetching alerts:', alertsResult.error)
        throw new DatabaseError(
          `Failed to fetch alerts: ${alertsResult.error.message}`
        )
      }

      const devices = devicesResult.data || []
      const alerts = alertsResult.data || []

      // Calculate stats
      // deno-lint-ignore no-explicit-any
      const totalDevices = devices.length
      // deno-lint-ignore no-explicit-any
      const onlineDevices = devices.filter(
        (d: any) => d.status === 'online'
      ).length
      // deno-lint-ignore no-explicit-any
      const offlineDevices = devices.filter(
        (d: any) => d.status === 'offline'
      ).length
      // deno-lint-ignore no-explicit-any
      const warningDevices = devices.filter(
        (d: any) => d.status === 'warning'
      ).length

      // deno-lint-ignore no-explicit-any
      const totalAlerts = alerts.length
      // deno-lint-ignore no-explicit-any
      const criticalAlerts = alerts.filter(
        (a: any) => a.severity === 'critical'
      ).length
      // deno-lint-ignore no-explicit-any
      const highAlerts = alerts.filter((a: any) => a.severity === 'high').length
      // deno-lint-ignore no-explicit-any
      const unresolvedAlerts = alerts.filter((a: any) => !a.is_resolved).length

      // Calculate uptime percentage
      const uptimePercentage =
        totalDevices > 0
          ? ((onlineDevices / totalDevices) * 100).toFixed(1)
          : '0.0'

      // Determine system health
      let systemStatus = 'healthy'
      if (criticalAlerts > 0) {
        systemStatus = 'critical'
      } else if (unresolvedAlerts > 5 || warningDevices > 0) {
        systemStatus = 'warning'
      } else if (onlineDevices < totalDevices * 0.9) {
        systemStatus = 'degraded'
      }

      // Get additional stats for complete dashboard
      // organizationId is guaranteed non-null (early return above)
      const membersQuery = supabaseAdmin
        .from('organization_members')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)

      const locationsQuery = supabaseAdmin
        .from('locations')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)

      const integrationsQuery = supabaseAdmin
        .from('device_integrations')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .eq('organization_id', organizationId)

      const [membersResult, locationsResult, integrationsResult] =
        await Promise.all([membersQuery, locationsQuery, integrationsQuery])

      const totalUsers = membersResult.count || 0
      const totalLocations = locationsResult.count || 0
      const activeIntegrations = integrationsResult.count || 0

      // Return flat structure matching frontend expectations
      const stats = {
        // Device stats (flat structure)
        totalDevices,
        onlineDevices,
        offlineDevices,
        warningDevices,
        uptimePercentage: parseFloat(uptimePercentage),

        // Alert stats (flat structure)
        totalAlerts,
        criticalAlerts,
        highAlerts,
        activeAlerts: unresolvedAlerts, // Frontend expects 'activeAlerts'
        unresolvedAlerts,

        // Organization stats
        totalUsers,
        totalLocations,
        activeIntegrations,

        // System status
        systemStatus,
        lastUpdated: new Date().toISOString(),

        // Metadata
        organizationId,
        queriedBy: userContext.email,
        isSuperAdmin: userContext.isSuperAdmin,
      }

      return createSuccessResponse(stats)
    }

    throw new Error('Method not allowed')
  },
  {
    allowedMethods: ['GET'],
  }
)
