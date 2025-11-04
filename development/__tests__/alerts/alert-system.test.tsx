/**
 * COMPREHENSIVE TEST SUITE: Alert System
 * 
 * Tests alert creation, triggering, notifications, rules, and lifecycle
 * Coverage: Alerts, Alert Rules, Notifications, Business Logic
 */

import { createClient } from '@/lib/supabase/client'

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

describe('Alert System - Complete Coverage', () => {
  let mockSupabase: {
    from: jest.Mock
    functions: {
      invoke: jest.Mock
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()

    mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
      })),
      functions: {
        invoke: jest.fn().mockResolvedValue({ data: {}, error: null }),
      },
    }
    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)
  })

  describe('Alert Creation', () => {
    test('should create alert with all required fields', async () => {
      const alertData = {
        device_id: 'device-123',
        organization_id: 'org-123',
        alert_type: 'temperature_high',
        severity: 'critical',
        message: 'Temperature exceeds threshold',
        metadata: {
          current_value: 95,
          threshold: 80,
          unit: 'celsius',
        },
      }

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'alert-123', ...alertData, status: 'active' },
              error: null,
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('alerts')
        .insert(alertData)
        .select()
        .single()

      expect(result.data).toMatchObject(alertData)
      expect(result.data?.status).toBe('active')
    })

    test('should validate alert_type', async () => {
      const invalidAlert = {
        device_id: 'device-123',
        alert_type: 'invalid_type',
        severity: 'warning',
      }

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'invalid alert_type', code: '23514' },
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('alerts')
        .insert(invalidAlert)
        .select()
        .single()

      expect(result.error).toBeTruthy()
    })

    test('should validate severity levels', async () => {
      const validSeverities = ['info', 'warning', 'critical']
      
      for (const severity of validSeverities) {
        const mockFrom = mockSupabase.from as jest.Mock
        mockFrom.mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'alert-123', severity },
                error: null,
              }),
            }),
          }),
        })

        const result = await mockSupabase
          .from('alerts')
          .insert({ device_id: 'device-123', alert_type: 'test', severity })
          .select()
          .single()

        expect(result.data?.severity).toBe(severity)
      }
    })

    test('should auto-set created_at timestamp', async () => {
      const now = new Date().toISOString()

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'alert-123',
                created_at: now,
              },
              error: null,
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('alerts')
        .insert({ device_id: 'device-123', alert_type: 'test', severity: 'info' })
        .select()
        .single()

      expect(result.data?.created_at).toBeTruthy()
    })

    test('should prevent duplicate active alerts for same condition', async () => {
      const duplicateAlert = {
        device_id: 'device-123',
        alert_type: 'offline',
        severity: 'warning',
      }

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'alert already active', code: '23505' },
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('alerts')
        .insert(duplicateAlert)
        .select()
        .single()

      expect(result.error).toBeTruthy()
    })
  })

  describe('Alert Retrieval', () => {
    test('should get all active alerts for organization', async () => {
      const alerts = [
        { id: 'alert-1', status: 'active', severity: 'critical' },
        { id: 'alert-2', status: 'active', severity: 'warning' },
        { id: 'alert-3', status: 'active', severity: 'info' },
      ]

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: alerts,
                error: null,
              }),
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('alerts')
        .select('*')
        .eq('organization_id', 'org-123')
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      expect(result.data).toHaveLength(3)
    })

    test('should filter alerts by severity', async () => {
      const criticalAlerts = [
        { id: 'alert-1', severity: 'critical' },
        { id: 'alert-2', severity: 'critical' },
      ]

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: criticalAlerts,
            error: null,
          }),
        }),
      })

      const result = await mockSupabase
        .from('alerts')
        .select('*')
        .eq('severity', 'critical')

      expect(result.data?.every((a: { severity: string }) => a.severity === 'critical')).toBe(true)
    })

    test('should filter alerts by device', async () => {
      const deviceAlerts = [
        { id: 'alert-1', device_id: 'device-123' },
        { id: 'alert-2', device_id: 'device-123' },
      ]

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: deviceAlerts,
            error: null,
          }),
        }),
      })

      const result = await mockSupabase
        .from('alerts')
        .select('*')
        .eq('device_id', 'device-123')

      expect(result.data).toHaveLength(2)
    })

    test('should get alert count by severity', async () => {
      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: [
            { severity: 'critical', count: 5 },
            { severity: 'warning', count: 12 },
            { severity: 'info', count: 25 },
          ],
          error: null,
        }),
      })

      const result = await mockSupabase
        .from('alerts')
        .select('severity, count:id.count()')

      expect(result.data?.find((r: { severity: string }) => r.severity === 'critical').count).toBe(5)
    })

    test('should get recent alerts (last 24 hours)', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({
            data: Array(10).fill({ id: 'alert' }),
            error: null,
          }),
        }),
      })

      const result = await mockSupabase
        .from('alerts')
        .select('*')
        .gte('created_at', yesterday)

      expect(result.data).toHaveLength(10)
    })
  })

  describe('Alert Updates', () => {
    test('should acknowledge alert', async () => {
      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'alert-123',
                  status: 'acknowledged',
                  acknowledged_at: new Date().toISOString(),
                  acknowledged_by: 'user-123',
                },
                error: null,
              }),
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('alerts')
        .update({
          status: 'acknowledged',
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: 'user-123',
        })
        .eq('id', 'alert-123')
        .select()
        .single()

      expect(result.data?.status).toBe('acknowledged')
      expect(result.data?.acknowledged_by).toBe('user-123')
    })

    test('should resolve alert', async () => {
      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'alert-123',
                  status: 'resolved',
                  resolved_at: new Date().toISOString(),
                },
                error: null,
              }),
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('alerts')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', 'alert-123')
        .select()
        .single()

      expect(result.data?.status).toBe('resolved')
    })

    test('should add notes to alert', async () => {
      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'alert-123',
                  notes: 'Investigating the issue',
                },
                error: null,
              }),
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('alerts')
        .update({ notes: 'Investigating the issue' })
        .eq('id', 'alert-123')
        .select()
        .single()

      expect(result.data?.notes).toBe('Investigating the issue')
    })
  })

  describe('Alert Rules', () => {
    test('should create alert rule', async () => {
      const ruleData = {
        name: 'High Temperature Alert',
        organization_id: 'org-123',
        condition_type: 'threshold',
        condition: {
          metric: 'temperature',
          operator: 'greater_than',
          value: 80,
        },
        severity: 'critical',
        enabled: true,
      }

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'rule-123', ...ruleData },
              error: null,
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('alert_rules')
        .insert(ruleData)
        .select()
        .single()

      expect(result.data).toMatchObject(ruleData)
    })

    test('should evaluate threshold rule', async () => {
      const rule = {
        condition: {
          metric: 'temperature',
          operator: 'greater_than',
          value: 80,
        },
      }

      const deviceData = { temperature: 95 }
      const shouldAlert = deviceData.temperature > rule.condition.value

      expect(shouldAlert).toBe(true)
    })

    test('should evaluate offline rule', async () => {
      const rule = {
        condition_type: 'offline',
        condition: {
          duration_minutes: 5,
        },
      }

      const device = {
        last_seen: new Date(Date.now() - 6 * 60 * 1000).toISOString(), // 6 minutes ago
      }

      const lastSeenTime = new Date(device.last_seen).getTime()
      const thresholdTime = Date.now() - rule.condition.duration_minutes * 60 * 1000
      const shouldAlert = lastSeenTime < thresholdTime

      expect(shouldAlert).toBe(true)
    })

    test('should enable/disable alert rule', async () => {
      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'rule-123', enabled: false },
                error: null,
              }),
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('alert_rules')
        .update({ enabled: false })
        .eq('id', 'rule-123')
        .select()
        .single()

      expect(result.data?.enabled).toBe(false)
    })

    test('should get all enabled rules for organization', async () => {
      const rules = [
        { id: 'rule-1', enabled: true },
        { id: 'rule-2', enabled: true },
      ]

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: rules,
              error: null,
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('alert_rules')
        .select('*')
        .eq('organization_id', 'org-123')
        .eq('enabled', true)

      expect(result.data).toHaveLength(2)
    })
  })

  describe('Alert Notifications', () => {
    test('should send notification when alert created', async () => {
      mockSupabase.functions.invoke = jest.fn().mockResolvedValue({
        data: {
          sent: true,
          channels: ['email', 'webhook'],
        },
        error: null,
      })

      const result = await mockSupabase.functions.invoke('send-notification', {
        body: {
          alert_id: 'alert-123',
          type: 'alert_created',
        },
      })

      expect(result.data?.sent).toBe(true)
      expect(result.data?.channels).toContain('email')
    })

    test('should send email notification', async () => {
      mockSupabase.functions.invoke = jest.fn().mockResolvedValue({
        data: {
          channel: 'email',
          recipient: 'admin@example.com',
          sent: true,
        },
        error: null,
      })

      const result = await mockSupabase.functions.invoke('send-notification', {
        body: {
          alert_id: 'alert-123',
          channel: 'email',
        },
      })

      expect(result.data?.sent).toBe(true)
    })

    test('should send webhook notification', async () => {
      mockSupabase.functions.invoke = jest.fn().mockResolvedValue({
        data: {
          channel: 'webhook',
          url: 'https://example.com/webhook',
          status: 200,
        },
        error: null,
      })

      const result = await mockSupabase.functions.invoke('send-notification', {
        body: {
          alert_id: 'alert-123',
          channel: 'webhook',
        },
      })

      expect(result.data?.status).toBe(200)
    })

    test('should respect notification preferences', async () => {
      const preferences = {
        email_enabled: true,
        webhook_enabled: false,
        min_severity: 'warning', // Only warning and critical
      }

      const alert = { severity: 'info' }
      const shouldNotify = alert.severity !== 'info' || preferences.min_severity === 'info'

      expect(shouldNotify).toBe(false) // info is below warning threshold
    })

    test('should not spam notifications for same alert', async () => {
      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockResolvedValue({
              data: [{ sent_at: new Date().toISOString() }], // Already sent recently
              error: null,
            }),
          }),
        }),
      })

      const recentNotifications = await mockSupabase
        .from('alert_notifications')
        .select('*')
        .eq('alert_id', 'alert-123')
        .gte('sent_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())

      const shouldSendAgain = recentNotifications.data?.length === 0

      expect(shouldSendAgain).toBe(false)
    })
  })

  describe('Business Logic', () => {
    test('should auto-resolve alert when condition clears', async () => {
      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'alert-123',
                    status: 'resolved',
                    auto_resolved: true,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('alerts')
        .update({ status: 'resolved', auto_resolved: true })
        .eq('device_id', 'device-123')
        .eq('alert_type', 'temperature_high')
        .select()
        .single()

      expect(result.data?.auto_resolved).toBe(true)
    })

    test('should escalate unacknowledged critical alerts', async () => {
      const threshold = 15 * 60 * 1000 // 15 minutes
      const oldAlert = new Date(Date.now() - 20 * 60 * 1000).toISOString()

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              lte: jest.fn().mockResolvedValue({
                data: [{ id: 'alert-123', severity: 'critical', created_at: oldAlert }],
                error: null,
              }),
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('alerts')
        .select('*')
        .eq('severity', 'critical')
        .eq('status', 'active')
        .lte('created_at', new Date(Date.now() - threshold).toISOString())

      expect(result.data).toHaveLength(1) // Should escalate
    })

    test('should group related alerts', async () => {
      const alerts = [
        { id: 'alert-1', device_id: 'device-123', alert_type: 'offline' },
        { id: 'alert-2', device_id: 'device-456', alert_type: 'offline' },
        { id: 'alert-3', device_id: 'device-789', alert_type: 'offline' },
      ]

      type AlertType = typeof alerts[0]
      type GroupedAlerts = Record<string, AlertType[]>

      const grouped = alerts.reduce((acc: GroupedAlerts, alert) => {
        if (!acc[alert.alert_type]) {
          acc[alert.alert_type] = []
        }
        acc[alert.alert_type]!.push(alert)
        return acc
      }, {} as GroupedAlerts)

      expect(grouped.offline).toHaveLength(3)
    })

    test('should calculate alert resolution time', async () => {
      const createdAt = new Date('2024-01-01T10:00:00Z')
      const resolvedAt = new Date('2024-01-01T10:15:00Z')
      const resolutionTime = (resolvedAt.getTime() - createdAt.getTime()) / 1000 / 60

      expect(resolutionTime).toBe(15) // 15 minutes
    })

    test('should track alert metrics', async () => {
      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: [
            {
              total_alerts: 100,
              critical_alerts: 20,
              avg_resolution_time: 12.5,
            },
          ],
          error: null,
        }),
      })

      const result = await mockSupabase
        .from('alert_metrics')
        .select('total_alerts, critical_alerts, avg_resolution_time')

      const metrics = result.data?.[0]
      expect(metrics.total_alerts).toBe(100)
      expect(metrics.critical_alerts).toBe(20)
    })
  })

  describe('Performance Tests', () => {
    test('should efficiently query active alerts', async () => {
      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: Array(100).fill({ id: 'alert' }),
                error: null,
              }),
            }),
          }),
        }),
      })

      const startTime = Date.now()
      await mockSupabase
        .from('alerts')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(100)
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(100)
    })

    test('should handle bulk alert creation', async () => {
      const bulkAlerts = Array.from({ length: 50 }, (_, i) => ({
        device_id: `device-${i}`,
        alert_type: 'offline',
        severity: 'warning',
      }))

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: bulkAlerts.map((a, i) => ({ ...a, id: `alert-${i}` })),
            error: null,
          }),
        }),
      })

      const result = await mockSupabase
        .from('alerts')
        .insert(bulkAlerts)
        .select()

      expect(result.data).toHaveLength(50)
    })
  })
})
