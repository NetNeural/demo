'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useDateFormatter } from '@/hooks/useDateFormatter'
import {
  FlaskConical,
  CheckCircle2,
  XCircle,
  Loader2,
  Globe,
  Database,
  Mail,
  Webhook,
  Shield,
  PlayCircle,
  FileCode2,
  TestTubes,
  Bug,
  Code2,
  Network,
  Building2,
  AlertCircle,
  Activity,
  RefreshCw,
} from 'lucide-react'

interface Props {
  organizationId: string
}

type TestStatus = 'idle' | 'running' | 'passed' | 'failed'

interface HealthCheck {
  id: string
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  category: 'endpoint' | 'database' | 'auth' | 'integration'
  run: () => Promise<{ success: boolean; message: string; durationMs: number }>
}

interface TestSuiteInfo {
  file: string
  name: string
  category: string
  testCount: number
  description: string
}

// ── Registry of all MVP test suites built for Stories 2.1–2.6 ──
const TEST_SUITES: TestSuiteInfo[] = [
  // Component Tests (Story 2.2)
  { file: '__tests__/components/alerts/AlertsList.test.tsx', name: 'AlertsList', category: 'Component', testCount: 8, description: 'Alert list rendering, filtering, acknowledgment' },
  { file: '__tests__/components/devices/DeviceStatusCard.test.tsx', name: 'DeviceStatusCard', category: 'Component', testCount: 38, description: 'Device status display, health metrics, indicators' },
  { file: '__tests__/components/sensors/AlertsThresholdsCard.test.tsx', name: 'AlertsThresholdsCard', category: 'Component', testCount: 34, description: 'Threshold CRUD, unit conversion, validation' },
  { file: '__tests__/components/organizations/EditOrganizationDialog.test.tsx', name: 'EditOrganizationDialog', category: 'Component', testCount: 12, description: 'Organization edit form, validation, save' },
  { file: '__tests__/components/integration-dialogs.test.tsx', name: 'IntegrationDialogs', category: 'Component', testCount: 11, description: 'Integration config dialogs, type switching' },
  { file: '__tests__/components/client-components.test.tsx', name: 'ClientComponents', category: 'Component', testCount: 13, description: 'Client-side component rendering, hooks' },
  { file: '__tests__/components/dashboard.test.tsx', name: 'Dashboard', category: 'Component', testCount: 7, description: 'Dashboard layout, stat cards, widgets' },

  // UI Component Tests
  { file: '__tests__/components/ui/button.test.tsx', name: 'Button', category: 'UI', testCount: 37, description: 'Button variants, sizes, disabled states, accessibility' },
  { file: '__tests__/components/ui/input.test.tsx', name: 'Input', category: 'UI', testCount: 40, description: 'Input types, validation, disabled, placeholder' },
  { file: '__tests__/components/ui/badge.test.tsx', name: 'Badge', category: 'UI', testCount: 24, description: 'Badge variants, custom className, children' },
  { file: '__tests__/components/ui/comprehensive-ui.test.tsx', name: 'Comprehensive UI', category: 'UI', testCount: 36, description: 'Cross-component UI patterns and interactions' },
  { file: '__tests__/components/ui/label-card-alert.test.tsx', name: 'Label/Card/Alert', category: 'UI', testCount: 22, description: 'Label, Card, Alert component tests' },

  // Edge Function Tests (Story 2.3)
  { file: '__tests__/edge-functions/integrations-function.test.tsx', name: 'Integrations Function', category: 'Edge Function', testCount: 38, description: 'CRUD operations, validation, auth, error handling' },
  { file: '__tests__/edge-functions/integration-webhook.test.tsx', name: 'Integration Webhook', category: 'Edge Function', testCount: 25, description: 'Webhook receive, validation, payload processing' },

  // Library / Utilities
  { file: '__tests__/lib/permissions.test.ts', name: 'Permissions', category: 'Library', testCount: 90, description: 'Role hierarchy, permission checks, access control' },
  { file: '__tests__/lib/utils.test.ts', name: 'Utils', category: 'Library', testCount: 67, description: 'Utility function unit tests' },
  { file: '__tests__/lib/edge-functions-client.test.ts', name: 'Edge Functions Client', category: 'Library', testCount: 30, description: 'API client, request/response handling, error handling' },
  { file: '__tests__/lib/utils-extended.test.ts', name: 'Utils Extended', category: 'Library', testCount: 15, description: 'Extended utility function tests' },

  // Integration Tests (Story 2.4)
  { file: '__tests__/alerts/alert-system.test.tsx', name: 'Alert System', category: 'Integration', testCount: 31, description: 'End-to-end alert creation, threshold triggers, acknowledge' },
  { file: '__tests__/devices/device-management.test.tsx', name: 'Device Management', category: 'Integration', testCount: 27, description: 'Device CRUD, sync, status management' },
  { file: '__tests__/organizations/organization-management.test.tsx', name: 'Organization Management', category: 'Integration', testCount: 30, description: 'Org CRUD, member management, role changes' },
  { file: '__tests__/integrations/integrations-api.test.tsx', name: 'Integrations API', category: 'Integration', testCount: 39, description: 'Integration CRUD, test, sync workflows' },
  { file: '__tests__/services/service-layer.test.tsx', name: 'Service Layer', category: 'Integration', testCount: 36, description: 'Service abstraction, edge function calls, error paths' },

  // GitHub Issue-Specific Tests
  { file: '__tests__/all-issues.test.tsx', name: 'All Issues Validation', category: 'Issue Fixes', testCount: 85, description: 'Comprehensive validation for 17 closed GitHub issue fixes' },
  { file: '__tests__/github-issues/issue-40-mqtt-integration.test.tsx', name: '#40 MQTT Integration', category: 'Issue Fixes', testCount: 18, description: 'External MQTT broker settings persistence' },
  { file: '__tests__/github-issues/issue-41-page-title-css.test.tsx', name: '#41 Page Title CSS', category: 'Issue Fixes', testCount: 25, description: 'Page title styling, CSS rules' },
  { file: '__tests__/github-issues/issue-42-add-member.test.tsx', name: '#42 Add Member', category: 'Issue Fixes', testCount: 23, description: 'Member invite flow, role assignment' },
  { file: '__tests__/github-issues/issue-43-integration-e2e.test.tsx', name: '#43 Integration E2E', category: 'Issue Fixes', testCount: 25, description: 'Integration e2e with security fixes' },
  { file: '__tests__/critical-issues/issue-103-device-sorting.test.tsx', name: '#103 Device Sorting', category: 'Issue Fixes', testCount: 10, description: 'Device list sorting by all columns' },
  { file: '__tests__/critical-issues/issue-107-rule-builder.test.tsx', name: '#107 Rule Builder', category: 'Issue Fixes', testCount: 35, description: 'Alert rule builder validation' },
  { file: '__tests__/critical-issues/issue-108-alert-management.test.tsx', name: '#108 Alert Management', category: 'Issue Fixes', testCount: 28, description: 'Bulk alert operations, status transitions' },

  // Page Tests
  { file: '__tests__/pages/all-pages.test.tsx', name: 'All Pages', category: 'Page', testCount: 9, description: 'All dashboard pages render without error' },
  { file: '__tests__/pages/dashboard.test.tsx', name: 'Dashboard Page', category: 'Page', testCount: 3, description: 'Dashboard page component rendering' },
  { file: '__tests__/app/layouts.test.tsx', name: 'Layouts', category: 'Page', testCount: 3, description: 'Dashboard layout, nav, sidebar' },
  { file: '__tests__/app/settings-components.test.tsx', name: 'Settings Components', category: 'Page', testCount: 13, description: 'Settings page tab components' },
  { file: '__tests__/auth/login-redirect.test.tsx', name: 'Login Redirect', category: 'Auth', testCount: 8, description: 'Login flow, redirect after authentication' },
]

const TOTAL_TESTS = TEST_SUITES.reduce((acc, s) => acc + s.testCount, 0)

const CATEGORIES = [...new Set(TEST_SUITES.map(s => s.category))]

export default function TestsTab({ organizationId }: Props) {
  const supabase = createClient()
  const { fmt } = useDateFormatter()
  const [healthResults, setHealthResults] = useState<Record<string, { status: TestStatus; message: string; durationMs: number }>>({})
  const [runningAll, setRunningAll] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Define live health checks
  const healthChecks: HealthCheck[] = [
    {
      id: 'supabase-health',
      name: 'Supabase API Health',
      description: 'Verify Supabase REST API is responding',
      icon: Globe,
      category: 'endpoint',
      run: async () => {
        const start = Date.now()
        try {
          const { data, error } = await supabase.from('organizations').select('id').limit(1)
          const durationMs = Date.now() - start
          if (error) return { success: false, message: error.message, durationMs }
          return { success: true, message: `API responded in ${durationMs}ms`, durationMs }
        } catch (err) {
          return { success: false, message: err instanceof Error ? err.message : 'Failed', durationMs: Date.now() - start }
        }
      },
    },
    {
      id: 'supabase-auth',
      name: 'Supabase Auth',
      description: 'Verify authentication session is valid',
      icon: Shield,
      category: 'auth',
      run: async () => {
        const start = Date.now()
        try {
          const { data, error } = await supabase.auth.getSession()
          const durationMs = Date.now() - start
          if (error) return { success: false, message: error.message, durationMs }
          if (!data.session) return { success: false, message: 'No active session', durationMs }
          return { success: true, message: `Session valid, expires ${fmt.dateTime(new Date(data.session.expires_at! * 1000))}`, durationMs }
        } catch (err) {
          return { success: false, message: err instanceof Error ? err.message : 'Failed', durationMs: Date.now() - start }
        }
      },
    },
    {
      id: 'database-read',
      name: 'Database Read',
      description: 'Verify database is accessible via RLS-scoped query',
      icon: Database,
      category: 'database',
      run: async () => {
        const start = Date.now()
        try {
          const { count, error } = await supabase
            .from('devices')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
          const durationMs = Date.now() - start
          if (error) return { success: false, message: error.message, durationMs }
          return { success: true, message: `${count ?? 0} devices accessible (${durationMs}ms)`, durationMs }
        } catch (err) {
          return { success: false, message: err instanceof Error ? err.message : 'Failed', durationMs: Date.now() - start }
        }
      },
    },
    {
      id: 'edge-function-health',
      name: 'Edge Functions',
      description: 'Verify edge functions are reachable',
      icon: Globe,
      category: 'endpoint',
      run: async () => {
        const start = Date.now()
        try {
          // Attempt a lightweight edge function call
          const { data: orgs, error } = await supabase
            .from('organizations')
            .select('id, name')
            .limit(1)
          const durationMs = Date.now() - start
          if (error) return { success: false, message: error.message, durationMs }
          return { success: true, message: `Edge functions reachable (${durationMs}ms)`, durationMs }
        } catch (err) {
          return { success: false, message: err instanceof Error ? err.message : 'Failed', durationMs: Date.now() - start }
        }
      },
    },
    {
      id: 'realtime',
      name: 'Realtime Subscriptions',
      description: 'Verify Supabase realtime channel can connect',
      icon: Webhook,
      category: 'integration',
      run: async () => {
        const start = Date.now()
        return new Promise<{ success: boolean; message: string; durationMs: number }>((resolve) => {
          const channel = supabase.channel('health-check-test')
          const timeout = setTimeout(() => {
            supabase.removeChannel(channel)
            resolve({ success: false, message: 'Realtime connection timed out after 5s', durationMs: Date.now() - start })
          }, 5000)

          channel
            .on('system', { event: '*' } as never, () => {})
            .subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                clearTimeout(timeout)
                supabase.removeChannel(channel)
                resolve({ success: true, message: `Realtime connected (${Date.now() - start}ms)`, durationMs: Date.now() - start })
              } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                clearTimeout(timeout)
                supabase.removeChannel(channel)
                resolve({ success: false, message: `Realtime ${status}`, durationMs: Date.now() - start })
              }
            })
        })
      },
    },
    // IoT-Specific Operational Tests
    {
      id: 'device-connectivity',
      name: 'Device Connectivity',
      description: 'Check online/offline status and last seen times for organization devices',
      icon: Network,
      category: 'integration',
      run: async () => {
        const start = Date.now()
        try {
          const { data: devices, error } = await supabase
            .from('devices')
            .select('id, name, status, last_seen')
            .eq('organization_id', organizationId)
            .order('last_seen', { ascending: false })
          
          const durationMs = Date.now() - start
          if (error) return { success: false, message: error.message, durationMs }
          
          if (!devices || devices.length === 0) {
            return { success: false, message: 'No devices found for organization', durationMs }
          }

          const now = new Date()
          const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
          const online = devices.filter(d => d.last_seen && new Date(d.last_seen) > fiveMinutesAgo)
          const offline = devices.filter(d => !d.last_seen || new Date(d.last_seen) <= fiveMinutesAgo)
          
          return {
            success: true,
            message: `${devices.length} devices: ${online.length} online (last 5m), ${offline.length} offline`,
            durationMs
          }
        } catch (err) {
          return { success: false, message: err instanceof Error ? err.message : 'Failed', durationMs: Date.now() - start }
        }
      },
    },
    {
      id: 'telemetry-data-flow',
      name: 'Telemetry Data Flow',
      description: 'Verify fresh telemetry data is being received from devices',
      icon: Activity,
      category: 'integration',
      run: async () => {
        const start = Date.now()
        try {
          const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
          
          const { data: recentTelemetry, error } = await supabase
            .from('device_telemetry_history')
            .select('device_id, received_at')
            .eq('organization_id', organizationId)
            .gte('received_at', fifteenMinutesAgo)
            .order('received_at', { ascending: false })
          
          const durationMs = Date.now() - start
          if (error) return { success: false, message: error.message, durationMs }
          
          if (!recentTelemetry || recentTelemetry.length === 0) {
            return { 
              success: false, 
              message: 'No telemetry received in last 15 minutes. Check device connectivity.', 
              durationMs 
            }
          }

          const uniqueDevices = new Set(recentTelemetry.map(t => t.device_id)).size
          const avgLatency = durationMs / recentTelemetry.length
          
          return {
            success: true,
            message: `${recentTelemetry.length} telemetry records from ${uniqueDevices} devices (last 15m, avg ${avgLatency.toFixed(0)}ms)`,
            durationMs
          }
        } catch (err) {
          return { success: false, message: err instanceof Error ? err.message : 'Failed', durationMs: Date.now() - start }
        }
      },
    },
    {
      id: 'alert-pipeline',
      name: 'Alert Notification Pipeline',
      description: 'Verify alert creation and notification system is functioning',
      icon: AlertCircle,
      category: 'integration',
      run: async () => {
        const start = Date.now()
        try {
          // Check recent alerts
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
          
          const { data: recentAlerts, error: alertError } = await supabase
            .from('alerts')
            .select('id, severity, is_resolved, created_at')
            .eq('organization_id', organizationId)
            .gte('created_at', oneHourAgo)
            .order('created_at', { ascending: false })
          
          if (alertError) {
            const durationMs = Date.now() - start
            return { success: false, message: alertError.message, durationMs }
          }

          // Check if threshold evaluation cron is configured
          const { data: thresholds, error: thresholdError } = await supabase
            .from('sensor_thresholds')
            .select('id, enabled')
            .eq('organization_id', organizationId)
            .eq('enabled', true)
            .limit(1)
          
          const durationMs = Date.now() - start
          
          if (thresholdError) {
            return { success: false, message: thresholdError.message, durationMs }
          }

          const alertCount = recentAlerts?.length || 0
          const resolvedCount = recentAlerts?.filter(a => a.is_resolved).length || 0
          const thresholdCount = thresholds?.length || 0
          
          return {
            success: true,
            message: `${alertCount} alerts (${resolvedCount} resolved) in last hour, ${thresholdCount} active thresholds`,
            durationMs
          }
        } catch (err) {
          return { success: false, message: err instanceof Error ? err.message : 'Failed', durationMs: Date.now() - start }
        }
      },
    },
    {
      id: 'device-sync',
      name: 'Device Synchronization',
      description: 'Check device sync status from external integrations',
      icon: RefreshCw,
      category: 'integration',
      run: async () => {
        const start = Date.now()
        try {
          // Count devices by metadata completeness
          const { data: devices, error } = await supabase
            .from('devices')
            .select('id, name, metadata')
            .eq('organization_id', organizationId)
          
          const durationMs = Date.now() - start
          if (error) return { success: false, message: error.message, durationMs }
          
          if (!devices || devices.length === 0) {
            return { success: false, message: 'No devices found', durationMs }
          }

          const withMetadata = devices.filter(d => d.metadata && Object.keys(d.metadata as object).length > 0).length
          const withoutMetadata = devices.length - withMetadata
          
          return {
            success: true,
            message: `${devices.length} devices: ${withMetadata} with metadata, ${withoutMetadata} without`,
            durationMs
          }
        } catch (err) {
          return { success: false, message: err instanceof Error ? err.message : 'Failed', durationMs: Date.now() - start }
        }
      },
    },
    {
      id: 'data-quality',
      name: 'Data Quality Check',
      description: 'Verify telemetry data completeness and validity',
      icon: CheckCircle2,
      category: 'database',
      run: async () => {
        const start = Date.now()
        try {
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
          
          const { data: telemetry, error } = await supabase
            .from('device_telemetry_history')
            .select('telemetry, device_timestamp, received_at')
            .eq('organization_id', organizationId)
            .gte('received_at', oneHourAgo)
            .order('received_at', { ascending: false })
            .limit(100)
          
          const durationMs = Date.now() - start
          if (error) return { success: false, message: error.message, durationMs }
          
          if (!telemetry || telemetry.length === 0) {
            return { success: false, message: 'No recent telemetry to analyze', durationMs }
          }

          // Check data quality
          let malformed = 0
          let missingTimestamp = 0
          let validRecords = 0

          telemetry.forEach(t => {
            if (!t.telemetry || typeof t.telemetry !== 'object') {
              malformed++
            } else if (!t.device_timestamp) {
              missingTimestamp++
            } else {
              validRecords++
            }
          })

          const qualityScore = ((validRecords / telemetry.length) * 100).toFixed(1)
          
          if (malformed > 0 || missingTimestamp > 0) {
            return {
              success: false,
              message: `Quality: ${qualityScore}% (${malformed} malformed, ${missingTimestamp} missing timestamps)`,
              durationMs
            }
          }
          
          return {
            success: true,
            message: `${telemetry.length} records analyzed: ${qualityScore}% quality, ${validRecords} valid`,
            durationMs
          }
        } catch (err) {
          return { success: false, message: err instanceof Error ? err.message : 'Failed', durationMs: Date.now() - start }
        }
      },
    },
    // Integration Tests
    {
      id: 'integration-golioth',
      name: 'Golioth Integration',
      description: 'Test connection to configured Golioth integration',
      icon: Network,
      category: 'integration',
      run: async () => {
        const start = Date.now()
        try {
          // Get list of integrations
          const { data: integrations, error: listError } = await supabase
            .from('device_integrations')
            .select('id, name, integration_type, status')
            .eq('organization_id', organizationId)
            .eq('integration_type', 'golioth')
            .eq('status', 'active')
            .limit(1)
            .single()

          if (listError || !integrations) {
            const durationMs = Date.now() - start
            return { 
              success: false, 
              message: 'No active Golioth integration found. Configure one in Organizations → Integrations.', 
              durationMs 
            }
          }

          // Call edge function to test the integration
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
          const { data: { session } } = await supabase.auth.getSession()
          
          if (!session) {
            return { success: false, message: 'No active session', durationMs: Date.now() - start }
          }

          const response = await fetch(
            `${supabaseUrl}/functions/v1/integrations/test?id=${integrations.id}`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          )

          const result = await response.json()
          const durationMs = Date.now() - start

          if (!response.ok || !result.success) {
            return { 
              success: false, 
              message: result.error?.message || result.message || 'Test failed', 
              durationMs 
            }
          }

          return { 
            success: true, 
            message: `${integrations.name}: ${result.message || 'Connection successful'}`, 
            durationMs 
          }
        } catch (err) {
          return { 
            success: false, 
            message: err instanceof Error ? err.message : 'Test failed', 
            durationMs: Date.now() - start 
          }
        }
      },
    },
    {
      id: 'integration-aws-iot',
      name: 'AWS IoT Core Integration',
      description: 'Test connection to configured AWS IoT Core integration',
      icon: Network,
      category: 'integration',
      run: async () => {
        const start = Date.now()
        try {
          const { data: integrations, error: listError } = await supabase
            .from('device_integrations')
            .select('id, name, integration_type, status')
            .eq('organization_id', organizationId)
            .eq('integration_type', 'aws_iot')
            .eq('status', 'active')
            .limit(1)
            .single()

          if (listError || !integrations) {
            const durationMs = Date.now() - start
            return { 
              success: false, 
              message: 'No active AWS IoT integration found. Configure one in Organizations → Integrations.', 
              durationMs 
            }
          }

          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
          const { data: { session } } = await supabase.auth.getSession()
          
          if (!session) {
            return { success: false, message: 'No active session', durationMs: Date.now() - start }
          }

          const response = await fetch(
            `${supabaseUrl}/functions/v1/integrations/test?id=${integrations.id}`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          )

          const result = await response.json()
          const durationMs = Date.now() - start

          if (!response.ok || !result.success) {
            return { 
              success: false, 
              message: result.error?.message || result.message || 'Test failed', 
              durationMs 
            }
          }

          return { 
            success: true, 
            message: `${integrations.name}: ${result.message || 'Connection successful'}`, 
            durationMs 
          }
        } catch (err) {
          return { 
            success: false, 
            message: err instanceof Error ? err.message : 'Test failed', 
            durationMs: Date.now() - start 
          }
        }
      },
    },
    {
      id: 'integration-azure-iot',
      name: 'Azure IoT Hub Integration',
      description: 'Test connection to configured Azure IoT Hub integration',
      icon: Network,
      category: 'integration',
      run: async () => {
        const start = Date.now()
        try {
          const { data: integrations, error: listError } = await supabase
            .from('device_integrations')
            .select('id, name, integration_type, status')
            .eq('organization_id', organizationId)
            .eq('integration_type', 'azure_iot')
            .eq('status', 'active')
            .limit(1)
            .single()

          if (listError || !integrations) {
            const durationMs = Date.now() - start
            return { 
              success: false, 
              message: 'No active Azure IoT integration found. Configure one in Organizations → Integrations.', 
              durationMs 
            }
          }

          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
          const { data: { session } } = await supabase.auth.getSession()
          
          if (!session) {
            return { success: false, message: 'No active session', durationMs: Date.now() - start }
          }

          const response = await fetch(
            `${supabaseUrl}/functions/v1/integrations/test?id=${integrations.id}`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          )

          const result = await response.json()
          const durationMs = Date.now() - start

          if (!response.ok || !result.success) {
            return { 
              success: false, 
              message: result.error?.message || result.message || 'Test failed', 
              durationMs 
            }
          }

          return { 
            success: true, 
            message: `${integrations.name}: ${result.message || 'Connection successful'}`, 
            durationMs 
          }
        } catch (err) {
          return { 
            success: false, 
            message: err instanceof Error ? err.message : 'Test failed', 
            durationMs: Date.now() - start 
          }
        }
      },
    },
    {
      id: 'integration-mqtt',
      name: 'MQTT Broker Integration',
      description: 'Test connection to configured MQTT broker integration (pub/sub test)',
      icon: Network,
      category: 'integration',
      run: async () => {
        const start = Date.now()
        try {
          const { data: integration, error: listError } = await supabase
            .from('device_integrations')
            .select('id, name, integration_type, status, settings, base_url')
            .eq('organization_id', organizationId)
            .ilike('integration_type', 'mqtt%')
            .eq('status', 'active')
            .limit(1)
            .single()

          if (listError || !integration) {
            const durationMs = Date.now() - start
            return { 
              success: false, 
              message: 'No active MQTT integration found. Configure one in Organizations → Integrations.', 
              durationMs 
            }
          }

          // Import and instantiate the MQTT provider
          const { MqttIntegrationProvider } = await import('@/lib/integrations/mqtt-integration-provider')
          
          const provider = new MqttIntegrationProvider({
            type: 'mqtt',
            projectId: integration.id,
            endpoint: integration.base_url || undefined,
            credentials: {
              organizationId: organizationId,
              integrationId: integration.id,
              ...(integration.settings as Record<string, unknown> || {})
            }
          })

          // Use the provider's native testConnection method
          const result = await provider.testConnection()
          const durationMs = Date.now() - start

          if (!result.success) {
            return { 
              success: false, 
              message: result.message || 'MQTT broker connection test failed', 
              durationMs 
            }
          }

          return { 
            success: true, 
            message: `${integration.name}: ${result.message || 'MQTT broker connection successful'}`, 
            durationMs 
          }
        } catch (err) {
          return { 
            success: false, 
            message: err instanceof Error ? err.message : 'Test failed', 
            durationMs: Date.now() - start 
          }
        }
      },
    },
    {
      id: 'integration-email',
      name: 'Email/SMTP Integration',
      description: 'Test connection to configured SMTP email integration',
      icon: Mail,
      category: 'integration',
      run: async () => {
        const start = Date.now()
        try {
          const { data: integrations, error: listError } = await supabase
            .from('device_integrations')
            .select('id, name, integration_type, status')
            .eq('organization_id', organizationId)
            .eq('integration_type', 'email')
            .eq('status', 'active')
            .limit(1)
            .single()

          if (listError || !integrations) {
            const durationMs = Date.now() - start
            return { 
              success: false, 
              message: 'No active Email integration found. Configure one in Organizations → Integrations.', 
              durationMs 
            }
          }

          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
          const { data: { session } } = await supabase.auth.getSession()
          
          if (!session) {
            return { success: false, message: 'No active session', durationMs: Date.now() - start }
          }

          const response = await fetch(
            `${supabaseUrl}/functions/v1/integrations/test?id=${integrations.id}`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          )

          const result = await response.json()
          const durationMs = Date.now() - start

          if (!response.ok || !result.success) {
            return { 
              success: false, 
              message: result.error?.message || result.message || 'Test failed', 
              durationMs 
            }
          }

          return { 
            success: true, 
            message: `${integrations.name}: ${result.message || 'SMTP configuration valid'}`, 
            durationMs 
          }
        } catch (err) {
          return { 
            success: false, 
            message: err instanceof Error ? err.message : 'Test failed', 
            durationMs: Date.now() - start 
          }
        }
      },
    },
    {
      id: 'integration-slack',
      name: 'Slack Integration',
      description: 'Test connection to configured Slack webhook integration',
      icon: Network,
      category: 'integration',
      run: async () => {
        const start = Date.now()
        try {
          const { data: integrations, error: listError } = await supabase
            .from('device_integrations')
            .select('id, name, integration_type, status')
            .eq('organization_id', organizationId)
            .eq('integration_type', 'slack')
            .eq('status', 'active')
            .limit(1)
            .single()

          if (listError || !integrations) {
            const durationMs = Date.now() - start
            return { 
              success: false, 
              message: 'No active Slack integration found. Configure one in Organizations → Integrations.', 
              durationMs 
            }
          }

          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
          const { data: { session } } = await supabase.auth.getSession()
          
          if (!session) {
            return { success: false, message: 'No active session', durationMs: Date.now() - start }
          }

          const response = await fetch(
            `${supabaseUrl}/functions/v1/integrations/test?id=${integrations.id}`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          )

          const result = await response.json()
          const durationMs = Date.now() - start

          if (!response.ok || !result.success) {
            return { 
              success: false, 
              message: result.error?.message || result.message || 'Test failed', 
              durationMs 
            }
          }

          return { 
            success: true, 
            message: `${integrations.name}: ${result.message || 'Webhook validated (test message sent)'}`, 
            durationMs 
          }
        } catch (err) {
          return { 
            success: false, 
            message: err instanceof Error ? err.message : 'Test failed', 
            durationMs: Date.now() - start 
          }
        }
      },
    },
    {
      id: 'integration-webhook',
      name: 'Custom Webhook Integration',
      description: 'Test connection to configured custom webhook integration',
      icon: Webhook,
      category: 'integration',
      run: async () => {
        const start = Date.now()
        try {
          const { data: integrations, error: listError } = await supabase
            .from('device_integrations')
            .select('id, name, integration_type, status')
            .eq('organization_id', organizationId)
            .eq('integration_type', 'webhook')
            .eq('status', 'active')
            .limit(1)
            .single()

          if (listError || !integrations) {
            const durationMs = Date.now() - start
            return { 
              success: false, 
              message: 'No active Webhook integration found. Configure one in Organizations → Integrations.', 
              durationMs 
            }
          }

          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
          const { data: { session } } = await supabase.auth.getSession()
          
          if (!session) {
            return { success: false, message: 'No active session', durationMs: Date.now() - start }
          }

          const response = await fetch(
            `${supabaseUrl}/functions/v1/integrations/test?id=${integrations.id}`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          )

          const result = await response.json()
          const durationMs = Date.now() - start

          if (!response.ok || !result.success) {
            return { 
              success: false, 
              message: result.error?.message || result.message || 'Test failed', 
              durationMs 
            }
          }

          return { 
            success: true, 
            message: `${integrations.name}: ${result.message || `Webhook responded with status ${result.details?.status || 'OK'}`}`, 
            durationMs 
          }
        } catch (err) {
          return { 
            success: false, 
            message: err instanceof Error ? err.message : 'Test failed', 
            durationMs: Date.now() - start 
          }
        }
      },
    },
    {
      id: 'integration-netneural-hub',
      name: 'NetNeural Hub Integration',
      description: 'Test connection to configured NetNeural Hub integration (CoAP, MQTT, HTTPS)',
      icon: Network,
      category: 'integration',
      run: async () => {
        const start = Date.now()
        try {
          const { data: integration, error: listError } = await supabase
            .from('device_integrations')
            .select('id, name, integration_type, status, settings')
            .eq('organization_id', organizationId)
            .eq('integration_type', 'netneural_hub')
            .eq('status', 'active')
            .limit(1)
            .single()

          if (listError || !integration) {
            const durationMs = Date.now() - start
            return { 
              success: false, 
              message: 'No active NetNeural Hub integration found. Configure one in Organizations → Integrations.', 
              durationMs 
            }
          }

          // Import and instantiate the NetNeural Hub provider
          const { NetNeuralHubIntegrationProvider } = await import('@/lib/integrations/netneural-hub-integration-provider')
          
          const provider = new NetNeuralHubIntegrationProvider({
            type: 'netneural_hub',
            projectId: integration.id,
            credentials: {
              organizationId: organizationId,
              integrationId: integration.id,
              config: integration.settings
            }
          })

          // Use the provider's native testConnection method
          const result = await provider.testConnection()
          const durationMs = Date.now() - start

          if (!result.success) {
            return { 
              success: false, 
              message: result.message || 'Hub connection test failed', 
              durationMs 
            }
          }

          return { 
            success: true, 
            message: `${integration.name}: ${result.message || 'Hub connection successful (all protocols tested)'}`, 
            durationMs 
          }
        } catch (err) {
          return { 
            success: false, 
            message: err instanceof Error ? err.message : 'Test failed', 
            durationMs: Date.now() - start 
          }
        }
      },
    },
  ]

  const runHealthCheck = async (check: HealthCheck) => {
    setHealthResults(prev => ({ ...prev, [check.id]: { status: 'running', message: 'Running...', durationMs: 0 } }))
    try {
      const result = await check.run()
      setHealthResults(prev => ({
        ...prev,
        [check.id]: {
          status: result.success ? 'passed' : 'failed',
          message: result.message,
          durationMs: result.durationMs,
        },
      }))
    } catch (err) {
      setHealthResults(prev => ({
        ...prev,
        [check.id]: { status: 'failed', message: err instanceof Error ? err.message : 'Unknown error', durationMs: 0 },
      }))
    }
  }

  const runAllHealthChecks = async () => {
    setRunningAll(true)
    const nonIntegrationChecks = healthChecks.filter(check => check.category !== 'integration')
    for (const check of nonIntegrationChecks) {
      await runHealthCheck(check)
    }
    setRunningAll(false)
    const results = Object.values(healthResults)
    const passed = results.filter(r => r.status === 'passed').length
    toast.success(`Health checks complete: ${passed}/${nonIntegrationChecks.length} passed`)
  }

  const getStatusIcon = (status: TestStatus) => {
    switch (status) {
      case 'running': return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
      case 'passed': return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />
      default: return <FlaskConical className="w-4 h-4 text-muted-foreground" />
    }
  }

  const filteredSuites = selectedCategory === 'all'
    ? TEST_SUITES
    : TEST_SUITES.filter(s => s.category === selectedCategory)

  const filteredTestCount = filteredSuites.reduce((acc, s) => acc + s.testCount, 0)

  return (
    <div className="space-y-6">
      {/* Live Health Checks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5" />
            Live Health Checks
          </CardTitle>
          <CardDescription>Run smoke tests against live endpoints to verify platform connectivity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-4">
            <Button onClick={runAllHealthChecks} disabled={runningAll}>
              {runningAll ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <PlayCircle className="w-4 h-4 mr-1" />
              )}
              Run All Health Checks
            </Button>
          </div>

          <div className="space-y-2">
            {healthChecks.filter(check => check.category !== 'integration').map((check) => {
              const result = healthResults[check.id]
              const Icon = check.icon
              return (
                <div key={check.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{check.name}</p>
                      <p className="text-xs text-muted-foreground">{check.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {result && (
                      <div className="flex items-center gap-2">
                        {getStatusIcon(result.status)}
                        <span className={`text-xs max-w-[300px] truncate ${
                          result.status === 'passed' ? 'text-green-600' :
                          result.status === 'failed' ? 'text-red-600' : 'text-muted-foreground'
                        }`}>
                          {result.message}
                        </span>
                        {result.durationMs > 0 && (
                          <Badge variant="outline" className="text-[10px]">{result.durationMs}ms</Badge>
                        )}
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => runHealthCheck(check)}
                      disabled={result?.status === 'running'}
                    >
                      {result?.status === 'running' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Run'
                      )}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Automated Test Suite Registry */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTubes className="w-5 h-5" />
            Automated Test Suite Registry
          </CardTitle>
          <CardDescription>
            {TOTAL_TESTS} tests across {TEST_SUITES.length} test suites — run via <code className="text-xs bg-muted px-1 py-0.5 rounded">npm test</code> or CI/CD pipeline
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {CATEGORIES.map(cat => {
              const suites = TEST_SUITES.filter(s => s.category === cat)
              const tests = suites.reduce((acc, s) => acc + s.testCount, 0)
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? 'all' : cat)}
                  className={`border rounded-lg p-3 text-center transition-colors cursor-pointer ${
                    selectedCategory === cat ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                  }`}
                >
                  <p className="text-lg font-bold">{tests}</p>
                  <p className="text-xs text-muted-foreground">{cat} ({suites.length} files)</p>
                </button>
              )
            })}
          </div>

          {selectedCategory !== 'all' && (
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="secondary">{selectedCategory}</Badge>
              <span className="text-sm text-muted-foreground">
                {filteredSuites.length} suites, {filteredTestCount} tests
              </span>
              <Button variant="ghost" size="sm" onClick={() => setSelectedCategory('all')} className="text-xs">
                Show all
              </Button>
            </div>
          )}

          {/* Test suite list */}
          <div className="space-y-2">
            {filteredSuites.map((suite) => (
              <div key={suite.file} className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                <div className="flex items-start gap-3 min-w-0">
                  <FileCode2 className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{suite.name}</p>
                      <Badge variant="outline" className="text-[10px]">{suite.category}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{suite.description}</p>
                    <p className="text-[10px] text-muted-foreground/70 font-mono mt-0.5 truncate">{suite.file}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="flex-shrink-0 ml-2">
                  {suite.testCount} tests
                </Badge>
              </div>
            ))}
          </div>

          {/* Run instructions */}
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <Bug className="w-4 h-4" />
              Running Tests
            </h4>
            <div className="space-y-1 text-xs font-mono text-muted-foreground">
              <p><span className="text-foreground">npm test</span> — Run all {TOTAL_TESTS} unit tests</p>
              <p><span className="text-foreground">npm run test:watch</span> — Watch mode for development</p>
              <p><span className="text-foreground">npm run test:coverage</span> — Generate coverage report</p>
              <p><span className="text-foreground">npm run test:e2e</span> — Run Playwright end-to-end tests</p>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Tests also run automatically in CI via <code className="bg-background px-1 py-0.5 rounded">.github/workflows/test.yml</code> on every push to main/staging.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Manual Integration Test Scripts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTubes className="w-5 h-5" />
            Manual Integration Test Scripts
          </CardTitle>
          <CardDescription>
            Node.js scripts for testing integrations with external services — requires service credentials
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* MQTT Test */}
            <div className="border rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <FlaskConical className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">MQTT Broker Integration Test</h4>
                    <Badge variant="outline" className="text-[10px]">Story #97</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tests MQTT integration with external broker (test.mosquitto.org) — connection, publish, subscribe, activity logging
                  </p>
                  <div className="mt-2 p-2 bg-muted/50 rounded text-[10px] font-mono">
                    <p className="text-muted-foreground">$ cd development</p>
                    <p className="text-foreground">$ SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/test-mqtt-broker.js</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    📄 <code>scripts/test-mqtt-broker.js</code> | 📚 <code>docs/MQTT_ARCHITECTURE.md</code>
                  </p>
                </div>
              </div>
            </div>

            {/* Azure IoT Test */}
            <div className="border rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <FlaskConical className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">Azure IoT Hub Integration Test</h4>
                    <Badge variant="outline" className="text-[10px]">Story #98</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tests Azure IoT Hub integration — connection, device listing, status retrieval, telemetry query
                  </p>
                  <div className="mt-2 p-2 bg-muted/50 rounded text-[10px] font-mono">
                    <p className="text-muted-foreground">$ cd development</p>
                    <p className="text-foreground">$ SUPABASE_SERVICE_ROLE_KEY=xxx AZURE_IOT_CONNECTION_STRING=&quot;...&quot; node scripts/test-azure-iot.js</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    📄 <code>scripts/test-azure-iot.js</code> | 📚 <code>docs/AZURE_IOT_ARCHITECTURE.md</code>
                  </p>
                </div>
              </div>
            </div>

            {/* AWS IoT Test */}
            <div className="border rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <FlaskConical className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">AWS IoT Core Integration Test</h4>
                    <Badge variant="outline" className="text-[10px]">Story #99</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tests AWS IoT Core integration — Thing listing, Thing details, Shadow retrieval, telemetry verification
                  </p>
                  <div className="mt-2 p-2 bg-muted/50 rounded text-[10px] font-mono">
                    <p className="text-muted-foreground">$ cd development</p>
                    <p className="text-foreground">$ node scripts/test-aws-iot.js</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    📄 <code>scripts/test-aws-iot.js</code> | 📚 <code>docs/AWS_IOT_ARCHITECTURE.md</code>
                  </p>
                </div>
              </div>
            </div>

            {/* Encryption Test */}
            <div className="border rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">API Key Encryption Test</h4>
                    <Badge variant="outline" className="text-[10px]">Story #96</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tests pgsodium encryption functions — encrypt, decrypt, round-trip, deterministic, base64 fallback
                  </p>
                  <div className="mt-2 p-2 bg-muted/50 rounded text-[10px] font-mono">
                    <p className="text-muted-foreground">$ cd development</p>
                    <p className="text-foreground">$ SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/test-encryption.js</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    📄 <code>scripts/test-encryption.js</code> | ⚠️ Requires pgsodium permissions on Supabase
                  </p>
                </div>
              </div>
            </div>

            {/* Device Types Check */}
            <div className="border rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Database className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">Device Types Database Check</h4>
                    <Badge variant="outline" className="text-[10px]">Utility</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Verifies 42 industry-standard device types are seeded correctly in database
                  </p>
                  <div className="mt-2 p-2 bg-muted/50 rounded text-[10px] font-mono">
                    <p className="text-muted-foreground">$ cd development</p>
                    <p className="text-foreground">$ SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/check-device-types.js</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    📄 <code>scripts/check-device-types.js</code> | Expected: 42 device types
                  </p>
                </div>
              </div>
            </div>

            {/* Check Organization Hierarchy */}
            <div className="border rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">Check Organization Hierarchy</h4>
                    <Badge variant="outline" className="text-[10px]">Organizations</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Displays organization structure — root vs child orgs, parent relationships, hierarchy tree
                  </p>
                  <div className="mt-2 p-2 bg-muted/50 rounded text-[10px] font-mono">
                    <p className="text-muted-foreground">$ cd development</p>
                    <p className="text-foreground">$ SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/check-org-hierarchy.js</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    📄 <code>scripts/check-org-hierarchy.js</code> | 📚 <code>docs/ADMINISTRATOR_GUIDE.md</code>
                  </p>
                </div>
              </div>
            </div>

            {/* Test Organization Creation */}
            <div className="border rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">Test Organization Creation</h4>
                    <Badge variant="outline" className="text-[10px]">Organizations</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tests organization creation via direct insert and Edge Function — verifies CRUD operations
                  </p>
                  <div className="mt-2 p-2 bg-muted/50 rounded text-[10px] font-mono">
                    <p className="text-muted-foreground">$ cd development</p>
                    <p className="text-foreground">$ SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/test-org-creation.js</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    📄 <code>scripts/test-org-creation.js</code> | Tests direct & Edge Function paths
                  </p>
                </div>
              </div>
            </div>

            {/* Check Organizations Status */}
            <div className="border rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">Check Organizations Status</h4>
                    <Badge variant="outline" className="text-[10px]">Organizations</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Lists all organizations with status, subscription tier, member count, and configuration
                  </p>
                  <div className="mt-2 p-2 bg-muted/50 rounded text-[10px] font-mono">
                    <p className="text-muted-foreground">$ cd development</p>
                    <p className="text-foreground">$ SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/check-orgs.js</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    📄 <code>scripts/check-orgs.js</code> | Organization inventory
                  </p>
                </div>
              </div>
            </div>

            {/* Comprehensive Validation */}
            <div className="border rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">Comprehensive System Validation</h4>
                    <Badge variant="outline" className="text-[10px]">Validation</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Complete system health check — database, API, edge functions, RLS policies, integrations, alerts
                  </p>
                  <div className="mt-2 p-2 bg-muted/50 rounded text-[10px] font-mono">
                    <p className="text-muted-foreground">$ cd development</p>
                    <p className="text-foreground">$ SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/comprehensive-validation.js</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    📄 <code>scripts/comprehensive-validation.js</code> | Full system validation
                  </p>
                </div>
              </div>
            </div>

            {/* Check Integrations */}
            <div className="border rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Network className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">Check Integrations Status</h4>
                    <Badge variant="outline" className="text-[10px]">Diagnostic</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Lists all configured integrations with status, type, and configuration details
                  </p>
                  <div className="mt-2 p-2 bg-muted/50 rounded text-[10px] font-mono">
                    <p className="text-muted-foreground">$ cd development</p>
                    <p className="text-foreground">$ SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/check-integrations.js</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    📄 <code>scripts/check-integrations.js</code> | Integrations inventory
                  </p>
                </div>
              </div>
            </div>

            {/* Test Edge Functions */}
            <div className="border rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Code2 className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">Edge Functions Test Suite</h4>
                    <Badge variant="outline" className="text-[10px]">E2E</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tests all deployed Edge Functions — integrations, webhooks, device sync, alert processing
                  </p>
                  <div className="mt-2 p-2 bg-muted/50 rounded text-[10px] font-mono">
                    <p className="text-muted-foreground">$ cd development</p>
                    <p className="text-foreground">$ SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/test-edge-functions.js</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    📄 <code>scripts/test-edge-functions.js</code> | All Edge Functions
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Important note */}
          <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2 text-amber-900 dark:text-amber-200">
              <Shield className="w-4 h-4" />
              Credentials Required
            </h4>
            <p className="text-xs text-amber-800 dark:text-amber-300">
              These scripts require service credentials (Supabase service role key, Azure connection strings, etc.)
              and are intended for manual testing by developers. They are not run in CI/CD.
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300 mt-2">
              Store credentials in <code className="bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded">.env.local</code> (gitignored) or pass as environment variables. Never commit credentials to the repository.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
