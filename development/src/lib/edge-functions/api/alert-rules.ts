import { edgeFunctions } from '../client'

export interface AlertRuleCondition {
  metric?: string
  operator?: '>' | '>=' | '<' | '<=' | '==' | '!='
  value?: number
  duration_minutes?: number
  offline_minutes?: number
  grace_period_hours?: number
}

export interface AlertRuleDeviceScope {
  type: 'all' | 'groups' | 'tags' | 'specific'
  values?: string[]
}

export interface AlertRuleAction {
  type: 'email' | 'sms' | 'webhook'
  recipients?: string[]
  webhook_url?: string
  message_template?: string
}

export interface AlertRule {
  id: string
  organization_id: string
  name: string
  description?: string
  rule_type: 'telemetry' | 'offline'
  condition: AlertRuleCondition
  device_scope: AlertRuleDeviceScope
  actions: AlertRuleAction[]
  enabled: boolean
  cooldown_minutes: number
  created_by: string
  created_at: string
  updated_at: string
  last_triggered_at?: string
}

export interface CreateAlertRuleInput {
  organization_id: string
  name: string
  description?: string
  rule_type: 'telemetry' | 'offline'
  condition: AlertRuleCondition
  device_scope: AlertRuleDeviceScope
  actions: AlertRuleAction[]
  enabled?: boolean
  cooldown_minutes?: number
}

export interface UpdateAlertRuleInput {
  name?: string
  description?: string
  condition?: AlertRuleCondition
  device_scope?: AlertRuleDeviceScope
  actions?: AlertRuleAction[]
  enabled?: boolean
  cooldown_minutes?: number
}

export const alertRules = {
  /**
   * List all alert rules for an organization
   */
  async list(
    organizationId: string,
    filters?: {
      rule_type?: 'telemetry' | 'offline'
      enabled?: boolean
    }
  ) {
    const params = new URLSearchParams({ organization_id: organizationId })
    
    if (filters?.rule_type) {
      params.append('rule_type', filters.rule_type)
    }
    
    if (filters?.enabled !== undefined) {
      params.append('enabled', String(filters.enabled))
    }

    return edgeFunctions.call<AlertRule[]>('/alert-rules', {
      method: 'GET',
      params: Object.fromEntries(params),
    })
  },

  /**
   * Get a single alert rule by ID
   */
  async get(ruleId: string) {
    return edgeFunctions.call<AlertRule>(`/alert-rules/${ruleId}`, {
      method: 'GET',
    })
  },

  /**
   * Create a new alert rule
   */
  async create(input: CreateAlertRuleInput) {
    return edgeFunctions.call<AlertRule>('/alert-rules', {
      method: 'POST',
      body: input,
    })
  },

  /**
   * Update an existing alert rule
   */
  async update(ruleId: string, input: UpdateAlertRuleInput) {
    return edgeFunctions.call<AlertRule>(`/alert-rules/${ruleId}`, {
      method: 'PUT',
      body: input,
    })
  },

  /**
   * Delete an alert rule
   */
  async delete(ruleId: string) {
    return edgeFunctions.call<void>(`/alert-rules/${ruleId}`, {
      method: 'DELETE',
    })
  },

  /**
   * Toggle enabled status of a rule
   */
  async toggle(ruleId: string, enabled: boolean) {
    return edgeFunctions.call<AlertRule>(`/alert-rules/${ruleId}/toggle`, {
      method: 'PATCH',
      body: { enabled },
    })
  },

  /**
   * Duplicate an existing rule
   */
  async duplicate(ruleId: string) {
    return edgeFunctions.call<AlertRule>(`/alert-rules/${ruleId}/duplicate`, {
      method: 'POST',
    })
  },
}
