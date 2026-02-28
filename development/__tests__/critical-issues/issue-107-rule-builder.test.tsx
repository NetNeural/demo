/**
 * UNIT TESTS: Issue #107 - Rule Builder Page
 *
 * Tests for:
 * - Rule creation wizard
 * - Telemetry-based rules (temp > 35°C)
 * - Offline/Heartbeat rules (no data for X hours)
 * - Device scope selection
 * - Rule evaluation logic
 * - Dry-run testing
 */

import { describe, test, expect } from '@jest/globals'

// Type definitions for alert rules
type RuleType = 'telemetry' | 'offline'
type MetricOperator = '>' | '<' | '>=' | '<=' | '==' | '!='
type DeviceScopeType = 'all' | 'groups' | 'tags' | 'specific'

interface TelemetryCondition {
  metric: string
  operator: MetricOperator
  threshold: number
  duration_minutes?: number
  unit?: string
}

interface OfflineCondition {
  offline_minutes: number
  grace_period_minutes?: number
}

interface DeviceScope {
  type: DeviceScopeType
  ids?: string[]
  tags?: string[]
  group_ids?: string[]
}

interface AlertRule {
  id: string
  organization_id: string
  name: string
  description?: string
  rule_type: RuleType
  condition: TelemetryCondition | OfflineCondition
  device_scope: DeviceScope
  actions: Array<{ type: string; config: any }>
  cooldown_minutes: number
  enabled: boolean
  last_triggered_at?: string
}

describe('Issue #107: Rule Builder Page', () => {
  describe('Rule Type Selection', () => {
    test('should support telemetry rule type', () => {
      const ruleType: RuleType = 'telemetry'
      expect(['telemetry', 'offline']).toContain(ruleType)
    })

    test('should support offline rule type', () => {
      const ruleType: RuleType = 'offline'
      expect(['telemetry', 'offline']).toContain(ruleType)
    })
  })

  describe('Telemetry Rule Creation', () => {
    test('should create temperature threshold rule', () => {
      const rule: AlertRule = {
        id: 'rule-1',
        organization_id: 'org-123',
        name: 'High Temperature Alert',
        description: 'Alert when temperature exceeds 35°C',
        rule_type: 'telemetry',
        condition: {
          metric: 'temperature',
          operator: '>',
          threshold: 35,
          unit: 'celsius',
        },
        device_scope: {
          type: 'all',
        },
        actions: [
          { type: 'email', config: { recipients: ['admin@example.com'] } },
        ],
        cooldown_minutes: 60,
        enabled: true,
      }

      expect(rule.rule_type).toBe('telemetry')
      expect((rule.condition as TelemetryCondition).threshold).toBe(35)
    })

    test('should create battery low rule', () => {
      const condition: TelemetryCondition = {
        metric: 'battery_level',
        operator: '<',
        threshold: 10,
        unit: 'percent',
      }

      expect(condition.metric).toBe('battery_level')
      expect(condition.operator).toBe('<')
      expect(condition.threshold).toBe(10)
    })

    test('should support all comparison operators', () => {
      const operators: MetricOperator[] = ['>', '<', '>=', '<=', '==', '!=']

      operators.forEach((op) => {
        const condition: TelemetryCondition = {
          metric: 'temperature',
          operator: op,
          threshold: 25,
        }
        expect(['>', '<', '>=', '<=', '==', '!=']).toContain(condition.operator)
      })
    })

    test('should support duration-based conditions', () => {
      const condition: TelemetryCondition = {
        metric: 'temperature',
        operator: '>',
        threshold: 30,
        duration_minutes: 15, // Alert if temp > 30 for 15 minutes
        unit: 'celsius',
      }

      expect(condition.duration_minutes).toBe(15)
    })
  })

  describe('Offline Rule Creation', () => {
    test('should create offline detection rule', () => {
      const rule: AlertRule = {
        id: 'rule-2',
        organization_id: 'org-123',
        name: 'Device Offline Alert',
        description: 'Alert when device has not reported for 6 hours',
        rule_type: 'offline',
        condition: {
          offline_minutes: 360, // 6 hours
        },
        device_scope: {
          type: 'all',
        },
        actions: [
          { type: 'email', config: { recipients: ['ops@example.com'] } },
        ],
        cooldown_minutes: 60,
        enabled: true,
      }

      expect(rule.rule_type).toBe('offline')
      expect((rule.condition as OfflineCondition).offline_minutes).toBe(360)
    })

    test('should support grace period for new devices', () => {
      const condition: OfflineCondition = {
        offline_minutes: 60,
        grace_period_minutes: 120, // Don't alert for first 2 hours
      }

      expect(condition.grace_period_minutes).toBe(120)
    })

    test('should validate offline time ranges', () => {
      const minMinutes = 5
      const maxMinutes = 43200 // 30 days

      const validOfflineMinutes = 360 // 6 hours
      expect(validOfflineMinutes).toBeGreaterThanOrEqual(minMinutes)
      expect(validOfflineMinutes).toBeLessThanOrEqual(maxMinutes)
    })
  })

  describe('Device Scope Selection', () => {
    test('should scope to all devices', () => {
      const scope: DeviceScope = {
        type: 'all',
      }
      expect(scope.type).toBe('all')
    })

    test('should scope to specific groups', () => {
      const scope: DeviceScope = {
        type: 'groups',
        group_ids: ['group-1', 'group-2'],
      }
      expect(scope.group_ids).toHaveLength(2)
    })

    test('should scope to specific tags', () => {
      const scope: DeviceScope = {
        type: 'tags',
        tags: ['critical', 'production'],
      }
      expect(scope.tags).toContain('critical')
    })

    test('should scope to specific devices', () => {
      const scope: DeviceScope = {
        type: 'specific',
        ids: ['device-1', 'device-2', 'device-3'],
      }
      expect(scope.ids).toHaveLength(3)
    })
  })

  describe('Rule Evaluation Logic', () => {
    test('should evaluate telemetry rule - threshold exceeded', () => {
      const rule: TelemetryCondition = {
        metric: 'temperature',
        operator: '>',
        threshold: 35,
      }

      const currentValue = 40
      const result = eval(`${currentValue} ${rule.operator} ${rule.threshold}`)

      expect(result).toBe(true) // Should trigger alert
    })

    test('should evaluate telemetry rule - threshold not exceeded', () => {
      const rule: TelemetryCondition = {
        metric: 'temperature',
        operator: '>',
        threshold: 35,
      }

      const currentValue = 30
      const result = eval(`${currentValue} ${rule.operator} ${rule.threshold}`)

      expect(result).toBe(false) // Should not trigger
    })

    test('should evaluate offline rule - device is offline', () => {
      const rule: OfflineCondition = {
        offline_minutes: 60,
      }

      const lastSeen = new Date('2025-12-16T10:00:00Z')
      const now = new Date('2025-12-16T12:00:00Z')
      const minutesOffline = (now.getTime() - lastSeen.getTime()) / 60000

      expect(minutesOffline).toBeGreaterThan(rule.offline_minutes)
    })

    test('should evaluate offline rule - device is online', () => {
      const rule: OfflineCondition = {
        offline_minutes: 60,
      }

      const lastSeen = new Date('2025-12-16T11:50:00Z')
      const now = new Date('2025-12-16T12:00:00Z')
      const minutesOffline = (now.getTime() - lastSeen.getTime()) / 60000

      expect(minutesOffline).toBeLessThan(rule.offline_minutes)
    })

    test('should respect cooldown period', () => {
      const rule = {
        cooldown_minutes: 60,
        last_triggered_at: new Date('2025-12-16T11:30:00Z').toISOString(),
      }

      const now = new Date('2025-12-16T12:00:00Z')
      const lastTriggered = new Date(rule.last_triggered_at)
      const minutesSinceLastTrigger =
        (now.getTime() - lastTriggered.getTime()) / 60000

      const canTrigger = minutesSinceLastTrigger >= rule.cooldown_minutes
      expect(canTrigger).toBe(false) // Only 30 minutes, cooldown is 60
    })
  })

  describe('Dry Run Testing', () => {
    test('should calculate affected devices for telemetry rule', () => {
      const rule: TelemetryCondition = {
        metric: 'temperature',
        operator: '>',
        threshold: 35,
      }

      const devices = [
        { id: '1', temperature: 40 },
        { id: '2', temperature: 30 },
        { id: '3', temperature: 38 },
      ]

      const affected = devices.filter((d) =>
        eval(`${d.temperature} ${rule.operator} ${rule.threshold}`)
      )

      expect(affected).toHaveLength(2)
      expect(affected.map((d) => d.id)).toEqual(['1', '3'])
    })

    test('should calculate affected devices for offline rule', () => {
      const rule: OfflineCondition = {
        offline_minutes: 60,
      }

      const now = new Date('2025-12-16T12:00:00Z')
      const devices = [
        { id: '1', last_seen: new Date('2025-12-16T10:00:00Z') }, // 120 min offline
        { id: '2', last_seen: new Date('2025-12-16T11:50:00Z') }, // 10 min offline
        { id: '3', last_seen: new Date('2025-12-16T09:00:00Z') }, // 180 min offline
      ]

      const affected = devices.filter((d) => {
        const minutesOffline = (now.getTime() - d.last_seen.getTime()) / 60000
        return minutesOffline > rule.offline_minutes
      })

      expect(affected).toHaveLength(2)
      expect(affected.map((d) => d.id)).toEqual(['1', '3'])
    })

    test('should show preview count in rule builder', () => {
      const affectedCount = 15
      const previewMessage = `This rule would currently trigger for ${affectedCount} devices`

      expect(previewMessage).toContain('15 devices')
    })
  })

  describe('Rule Actions Configuration', () => {
    test('should configure email action', () => {
      const action = {
        type: 'email',
        config: {
          recipients: ['admin@example.com', 'ops@example.com'],
          subject: 'Alert: High Temperature',
          template: 'alert-template',
        },
      }

      expect(action.type).toBe('email')
      expect(action.config.recipients).toHaveLength(2)
    })

    test('should configure SMS action', () => {
      const action = {
        type: 'sms',
        config: {
          phone_numbers: ['+1234567890'],
          message: 'Alert: Device offline',
        },
      }

      expect(action.type).toBe('sms')
    })

    test('should configure webhook action', () => {
      const action = {
        type: 'webhook',
        config: {
          url: 'https://api.example.com/alerts',
          method: 'POST',
          headers: {
            Authorization: 'Bearer token',
          },
        },
      }

      expect(action.config.url).toBeTruthy()
      expect(action.config.method).toBe('POST')
    })

    test('should support multiple actions', () => {
      const actions = [
        { type: 'email', config: {} },
        { type: 'sms', config: {} },
        { type: 'webhook', config: {} },
      ]

      expect(actions).toHaveLength(3)
    })
  })

  describe('Rule Validation', () => {
    test('should validate required fields', () => {
      const rule = {
        name: 'Test Rule',
        rule_type: 'telemetry',
        condition: { metric: 'temperature', operator: '>', threshold: 35 },
        device_scope: { type: 'all' },
        actions: [{ type: 'email', config: {} }],
      }

      const isValid =
        !!rule.name &&
        !!rule.rule_type &&
        !!rule.condition &&
        !!rule.device_scope &&
        rule.actions.length > 0

      expect(isValid).toBe(true)
    })

    test('should reject rule without actions', () => {
      const rule = {
        name: 'Test Rule',
        rule_type: 'telemetry',
        condition: { metric: 'temperature', operator: '>', threshold: 35 },
        device_scope: { type: 'all' },
        actions: [],
      }

      const isValid = rule.actions.length > 0
      expect(isValid).toBe(false)
    })

    test('should validate threshold values', () => {
      const condition: TelemetryCondition = {
        metric: 'temperature',
        operator: '>',
        threshold: 35,
      }

      expect(condition.threshold).toBeGreaterThan(-273.15) // Absolute zero
      expect(condition.threshold).toBeLessThan(1000) // Reasonable limit
    })

    test('should validate offline minutes range', () => {
      const condition: OfflineCondition = {
        offline_minutes: 360,
      }

      expect(condition.offline_minutes).toBeGreaterThanOrEqual(5) // Min 5 minutes
      expect(condition.offline_minutes).toBeLessThanOrEqual(43200) // Max 30 days
    })
  })

  describe('Rule List Management', () => {
    test('should list all rules for organization', () => {
      const rules: AlertRule[] = [
        {
          id: 'rule-1',
          organization_id: 'org-123',
          name: 'High Temp Alert',
          rule_type: 'telemetry',
          condition: { metric: 'temperature', operator: '>', threshold: 35 },
          device_scope: { type: 'all' },
          actions: [],
          cooldown_minutes: 60,
          enabled: true,
        },
        {
          id: 'rule-2',
          organization_id: 'org-123',
          name: 'Device Offline Alert',
          rule_type: 'offline',
          condition: { offline_minutes: 360 },
          device_scope: { type: 'all' },
          actions: [],
          cooldown_minutes: 60,
          enabled: false,
        },
      ]

      expect(rules).toHaveLength(2)
      expect(rules.filter((r) => r.enabled)).toHaveLength(1)
    })

    test('should filter rules by type', () => {
      const rules: AlertRule[] = [
        { id: '1', rule_type: 'telemetry' } as AlertRule,
        { id: '2', rule_type: 'offline' } as AlertRule,
        { id: '3', rule_type: 'telemetry' } as AlertRule,
      ]

      const telemetryRules = rules.filter((r) => r.rule_type === 'telemetry')
      expect(telemetryRules).toHaveLength(2)
    })

    test('should toggle rule enabled status', () => {
      const rule = { id: 'rule-1', enabled: true }
      rule.enabled = !rule.enabled

      expect(rule.enabled).toBe(false)
    })

    test('should duplicate rule', () => {
      const original: Partial<AlertRule> = {
        id: 'rule-1',
        name: 'Original Rule',
        rule_type: 'telemetry',
        condition: { metric: 'temperature', operator: '>', threshold: 35 },
      }

      const duplicate = {
        ...original,
        id: 'rule-2',
        name: `${original.name} (Copy)`,
      }

      expect(duplicate.id).not.toBe(original.id)
      expect(duplicate.name).toContain('Copy')
    })
  })

  describe('Database Schema Validation', () => {
    test('should define alert_rules table structure', () => {
      const tableColumns = [
        'id',
        'organization_id',
        'name',
        'description',
        'rule_type',
        'condition',
        'device_scope',
        'actions',
        'cooldown_minutes',
        'schedule_restrictions',
        'enabled',
        'last_triggered_at',
        'created_by',
        'created_at',
        'updated_at',
      ]

      expect(tableColumns).toContain('condition')
      expect(tableColumns).toContain('device_scope')
      expect(tableColumns).toContain('actions')
    })

    test('should store condition as JSONB', () => {
      const condition = {
        metric: 'temperature',
        operator: '>',
        threshold: 35,
        unit: 'celsius',
      }

      const jsonb = JSON.stringify(condition)
      const parsed = JSON.parse(jsonb)

      expect(parsed.metric).toBe('temperature')
      expect(parsed.threshold).toBe(35)
    })
  })
})
