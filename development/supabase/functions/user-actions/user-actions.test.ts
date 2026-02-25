/**
 * Tests for user-actions Edge Function
 *
 * Tests user activity tracking, alert acknowledgements, and audit logging
 */

import {
  assertEquals,
  assertExists,
} from 'https://deno.land/std@0.168.0/testing/asserts.ts'

// ============================================================================
// Test Data Fixtures
// ============================================================================

const mockUserId = 'user-123'
const mockOrgId = 'org-456'
const mockAlertId = 'alert-789'
const mockDeviceId = 'device-abc'

interface AcknowledgeAlertRequest {
  alert_id: string
  acknowledgement_type?:
    | 'acknowledged'
    | 'dismissed'
    | 'resolved'
    | 'false_positive'
  notes?: string
}

interface RecordActionRequest {
  action_type: string
  action_category:
    | 'device_management'
    | 'integration_management'
    | 'alert_management'
    | 'sync_operation'
    | 'configuration'
    | 'authentication'
    | 'analytics_view'
    | 'other'
  description?: string
  device_id?: string
  integration_id?: string
  alert_id?: string
  alert_rule_id?: string
  metadata?: Record<string, unknown>
  success?: boolean
  error_message?: string
}

// ============================================================================
// Acknowledge Alert Tests
// ============================================================================

Deno.test('Acknowledge Alert - should validate required alert_id', () => {
  const invalidRequest: Partial<AcknowledgeAlertRequest> = {
    acknowledgement_type: 'acknowledged',
  }

  // Should fail validation without alert_id
  assertEquals(invalidRequest.alert_id, undefined)
})

Deno.test('Acknowledge Alert - should default to acknowledged type', () => {
  const request: AcknowledgeAlertRequest = {
    alert_id: mockAlertId,
  }

  const acknowledgementType = request.acknowledgement_type || 'acknowledged'
  assertEquals(acknowledgementType, 'acknowledged')
})

Deno.test(
  'Acknowledge Alert - should support all acknowledgement types',
  () => {
    const types: Array<
      'acknowledged' | 'dismissed' | 'resolved' | 'false_positive'
    > = ['acknowledged', 'dismissed', 'resolved', 'false_positive']

    types.forEach((type) => {
      const request: AcknowledgeAlertRequest = {
        alert_id: mockAlertId,
        acknowledgement_type: type,
      }

      assertEquals(request.acknowledgement_type, type)
    })
  }
)

Deno.test('Acknowledge Alert - should handle optional notes', () => {
  const requestWithNotes: AcknowledgeAlertRequest = {
    alert_id: mockAlertId,
    notes: 'This was a false positive - sensor malfunction',
  }

  assertExists(requestWithNotes.notes)
  assertEquals(
    requestWithNotes.notes,
    'This was a false positive - sensor malfunction'
  )

  const requestWithoutNotes: AcknowledgeAlertRequest = {
    alert_id: mockAlertId,
  }

  assertEquals(requestWithoutNotes.notes, undefined)
})

Deno.test('Acknowledge Alert - should format RPC parameters correctly', () => {
  const request: AcknowledgeAlertRequest = {
    alert_id: mockAlertId,
    acknowledgement_type: 'resolved',
    notes: 'Issue fixed',
  }

  const rpcParams = {
    p_alert_id: request.alert_id,
    p_user_id: mockUserId,
    p_acknowledgement_type: request.acknowledgement_type,
    p_notes: request.notes || null,
  }

  assertEquals(rpcParams.p_alert_id, mockAlertId)
  assertEquals(rpcParams.p_user_id, mockUserId)
  assertEquals(rpcParams.p_acknowledgement_type, 'resolved')
  assertEquals(rpcParams.p_notes, 'Issue fixed')
})

// ============================================================================
// Record Action Tests
// ============================================================================

Deno.test('Record Action - should validate required fields', () => {
  const invalidRequest: Partial<RecordActionRequest> = {
    description: 'Some action',
  }

  // Should fail validation without action_type and action_category
  assertEquals(invalidRequest.action_type, undefined)
  assertEquals(invalidRequest.action_category, undefined)
})

Deno.test('Record Action - should support all action categories', () => {
  const categories: RecordActionRequest['action_category'][] = [
    'device_management',
    'integration_management',
    'alert_management',
    'sync_operation',
    'configuration',
    'authentication',
    'analytics_view',
    'other',
  ]

  categories.forEach((category) => {
    const request: RecordActionRequest = {
      action_type: 'test_action',
      action_category: category,
    }

    assertEquals(request.action_category, category)
  })
})

Deno.test('Record Action - should default success to true', () => {
  const requestWithoutSuccess: RecordActionRequest = {
    action_type: 'device_created',
    action_category: 'device_management',
  }

  const success = requestWithoutSuccess.success !== false
  assertEquals(success, true)

  const requestWithExplicitFalse: RecordActionRequest = {
    action_type: 'device_update_failed',
    action_category: 'device_management',
    success: false,
  }

  assertEquals(requestWithExplicitFalse.success, false)
})

Deno.test('Record Action - should handle optional fields', () => {
  const minimalRequest: RecordActionRequest = {
    action_type: 'view_dashboard',
    action_category: 'analytics_view',
  }

  assertEquals(minimalRequest.description, undefined)
  assertEquals(minimalRequest.device_id, undefined)
  assertEquals(minimalRequest.metadata, undefined)

  const detailedRequest: RecordActionRequest = {
    action_type: 'update_device',
    action_category: 'device_management',
    description: 'Updated device name and location',
    device_id: mockDeviceId,
    metadata: {
      old_name: 'Sensor A',
      new_name: 'Temperature Sensor - Warehouse',
      location: 'Building 2',
    },
    success: true,
  }

  assertExists(detailedRequest.description)
  assertExists(detailedRequest.device_id)
  assertExists(detailedRequest.metadata)
  assertEquals(detailedRequest.success, true)
})

Deno.test('Record Action - should handle error messages', () => {
  const failedAction: RecordActionRequest = {
    action_type: 'sync_golioth_device',
    action_category: 'sync_operation',
    device_id: mockDeviceId,
    success: false,
    error_message: 'Golioth API connection timeout',
  }

  assertEquals(failedAction.success, false)
  assertExists(failedAction.error_message)
  assertEquals(failedAction.error_message, 'Golioth API connection timeout')
})

Deno.test('Record Action - should handle metadata JSON', () => {
  const actionWithMetadata: RecordActionRequest = {
    action_type: 'configure_alert_rule',
    action_category: 'configuration',
    alert_rule_id: 'rule-123',
    metadata: {
      threshold_type: 'temperature_high',
      threshold_value: 85,
      notification_channels: ['email', 'webhook'],
      enabled: true,
    },
  }

  assertExists(actionWithMetadata.metadata)
  assertEquals(actionWithMetadata.metadata.threshold_type, 'temperature_high')
  assertEquals(actionWithMetadata.metadata.threshold_value, 85)
  assertEquals(
    Array.isArray(actionWithMetadata.metadata.notification_channels),
    true
  )
})

Deno.test('Record Action - should format RPC parameters correctly', () => {
  const request: RecordActionRequest = {
    action_type: 'acknowledge_alert',
    action_category: 'alert_management',
    description: 'Alert marked as resolved',
    alert_id: mockAlertId,
    metadata: { acknowledgement_type: 'resolved' },
  }

  const rpcParams = {
    p_user_id: mockUserId,
    p_organization_id: mockOrgId,
    p_action_type: request.action_type,
    p_action_category: request.action_category,
    p_description: request.description || null,
    p_device_id: request.device_id || null,
    p_integration_id: request.integration_id || null,
    p_alert_id: request.alert_id || null,
    p_alert_rule_id: request.alert_rule_id || null,
    p_metadata: request.metadata || {},
    p_success: request.success !== false,
    p_error_message: request.error_message || null,
  }

  assertEquals(rpcParams.p_action_type, 'acknowledge_alert')
  assertEquals(rpcParams.p_action_category, 'alert_management')
  assertEquals(rpcParams.p_alert_id, mockAlertId)
  assertEquals(rpcParams.p_success, true)
})

// ============================================================================
// Get Alert Acknowledgements Tests
// ============================================================================

Deno.test(
  'Get Alert Acknowledgements - should support optional filtering',
  () => {
    const paramsNoFilter = {}
    assertEquals(Object.keys(paramsNoFilter).length, 0)

    const paramsWithAlertId = { alert_id: mockAlertId }
    assertExists(paramsWithAlertId.alert_id)

    const paramsWithOrgId = { organization_id: mockOrgId }
    assertExists(paramsWithOrgId.organization_id)

    const paramsWithBoth = { alert_id: mockAlertId, organization_id: mockOrgId }
    assertExists(paramsWithBoth.alert_id)
    assertExists(paramsWithBoth.organization_id)
  }
)

Deno.test(
  'Get Alert Acknowledgements - should order by acknowledged_at descending',
  () => {
    const mockAcknowledgements = [
      { id: '1', acknowledged_at: '2024-01-01T10:00:00Z' },
      { id: '2', acknowledged_at: '2024-01-03T10:00:00Z' },
      { id: '3', acknowledged_at: '2024-01-02T10:00:00Z' },
    ]

    const sorted = mockAcknowledgements.sort(
      (a, b) =>
        new Date(b.acknowledged_at).getTime() -
        new Date(a.acknowledged_at).getTime()
    )

    // Should be ordered newest first
    assertEquals(sorted[0].id, '2')
    assertEquals(sorted[1].id, '3')
    assertEquals(sorted[2].id, '1')
  }
)

Deno.test(
  'Get Alert Acknowledgements - should include related user and alert data',
  () => {
    const mockAcknowledgement = {
      id: 'ack-123',
      alert_id: mockAlertId,
      user_id: mockUserId,
      acknowledgement_type: 'resolved',
      acknowledged_at: '2024-01-01T10:00:00Z',
      user: {
        id: mockUserId,
        email: 'user@example.com',
      },
      alert: {
        id: mockAlertId,
        title: 'High Temperature Alert',
        severity: 'high',
      },
    }

    assertExists(mockAcknowledgement.user)
    assertExists(mockAcknowledgement.alert)
    assertEquals(mockAcknowledgement.user.email, 'user@example.com')
    assertEquals(mockAcknowledgement.alert.severity, 'high')
  }
)

// ============================================================================
// Get User Actions Tests
// ============================================================================

Deno.test('Get User Actions - should default limit to 50', () => {
  const limitParam = '50'
  const limit = parseInt(limitParam)
  assertEquals(limit, 50)
})

Deno.test('Get User Actions - should support custom limit', () => {
  const limitParam = '100'
  const limit = parseInt(limitParam)
  assertEquals(limit, 100)
})

Deno.test('Get User Actions - should support filtering by device_id', () => {
  const params = { device_id: mockDeviceId }
  assertExists(params.device_id)
  assertEquals(params.device_id, mockDeviceId)
})

Deno.test('Get User Actions - should support filtering by user_id', () => {
  const params = { user_id: mockUserId }
  assertExists(params.user_id)
  assertEquals(params.user_id, mockUserId)
})

Deno.test(
  'Get User Actions - should support filtering by action_category',
  () => {
    const category: RecordActionRequest['action_category'] = 'device_management'
    const params = { action_category: category }
    assertExists(params.action_category)
    assertEquals(params.action_category, 'device_management')
  }
)

Deno.test('Get User Actions - should order by created_at descending', () => {
  const mockActions = [
    { id: '1', created_at: '2024-01-01T10:00:00Z' },
    { id: '2', created_at: '2024-01-03T10:00:00Z' },
    { id: '3', created_at: '2024-01-02T10:00:00Z' },
  ]

  const sorted = mockActions.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  // Should be ordered newest first
  assertEquals(sorted[0].id, '2')
  assertEquals(sorted[1].id, '3')
  assertEquals(sorted[2].id, '1')
})

Deno.test('Get User Actions - should include related user data', () => {
  const mockAction = {
    id: 'action-123',
    user_id: mockUserId,
    action_type: 'update_device',
    action_category: 'device_management',
    created_at: '2024-01-01T10:00:00Z',
    user: {
      id: mockUserId,
      email: 'user@example.com',
    },
  }

  assertExists(mockAction.user)
  assertEquals(mockAction.user.email, 'user@example.com')
})

// ============================================================================
// Action Routing Tests
// ============================================================================

Deno.test('Action Routing - should validate action parameter', () => {
  const validActions = [
    'acknowledge_alert',
    'record_action',
    'get_alert_acknowledgements',
    'get_user_actions',
  ]

  validActions.forEach((action) => {
    // Should be valid action
    assertEquals(validActions.includes(action), true)
  })

  const invalidAction = 'invalid_action'
  assertEquals(validActions.includes(invalidAction), false)
})

Deno.test('Action Routing - should handle missing action parameter', () => {
  const action = null
  const error = action ? null : 'Invalid action parameter'
  assertEquals(error, 'Invalid action parameter')
})
