/**
 * Integrations API Module
 */

import type { EdgeFunctionResponse, EdgeFunctionOptions } from '../types'

export interface IntegrationsAPI {
  list: (organizationId: string) => Promise<EdgeFunctionResponse<unknown>>
  create: (data: {
    organizationId: string
    integrationType: string
    name: string
    config: Record<string, unknown>
  }) => Promise<EdgeFunctionResponse<unknown>>
  update: (
    integrationId: string,
    data: {
      name?: string
      settings?: Record<string, unknown>
      config?: Record<string, unknown>
      status?: string
    }
  ) => Promise<EdgeFunctionResponse<unknown>>
  delete: (integrationId: string) => Promise<EdgeFunctionResponse<unknown>>
  test: (integrationId: string) => Promise<EdgeFunctionResponse<unknown>>
  sync: (data: {
    integrationId: string
    organizationId: string
    operation: 'test' | 'import' | 'export' | 'bidirectional'
    deviceIds?: string[]
  }) => Promise<EdgeFunctionResponse<unknown>>
  getActivityLog: (
    integrationId: string,
    options?: {
      organizationId?: string
      limit?: number
      direction?: 'incoming' | 'outgoing' | 'all'
      status?: 'success' | 'failed' | 'all'
    }
  ) => Promise<EdgeFunctionResponse<unknown>>

  // Notification methods
  sendNotification: (data: {
    organization_id: string
    integration_id: string
    message: string
    severity?: string
    metadata?: Record<string, unknown>
  }) => Promise<EdgeFunctionResponse<unknown>>

  // MQTT methods
  publishMqtt: (data: {
    organization_id: string
    integration_id: string
    topic: string
    message: string
  }) => Promise<EdgeFunctionResponse<unknown>>

  subscribeMqtt: (data: {
    organization_id: string
    integration_id: string
    topic: string
  }) => Promise<EdgeFunctionResponse<unknown>>
}

export function createIntegrationsAPI(
  call: <T>(
    functionName: string,
    options?: EdgeFunctionOptions
  ) => Promise<EdgeFunctionResponse<T>>
): IntegrationsAPI {
  return {
    /**
     * List integrations for an organization
     */
    list: (organizationId) =>
      call('integrations', {
        params: { organization_id: organizationId },
      }),

    /**
     * Create a new integration
     */
    create: (data) =>
      call('integrations', {
        method: 'POST',
        body: data,
      }),

    /**
     * Update an integration
     */
    update: (integrationId, data) =>
      call('integrations', {
        method: 'PUT',
        params: { id: integrationId },
        body: data,
      }),

    /**
     * Delete an integration
     */
    delete: (integrationId) =>
      call('integrations', {
        method: 'DELETE',
        params: { id: integrationId },
      }),

    /**
     * Test an integration configuration
     */
    test: (integrationId) =>
      call(`integration-test`, {
        method: 'POST',
        body: { integrationId },
      }),

    /**
     * Trigger device sync
     */
    sync: (data) =>
      call('device-sync', {
        method: 'POST',
        body: data,
      }),

    /**
     * Get activity logs for an integration
     */
    getActivityLog: (integrationId, options = {}) =>
      call('integrations/activity', {
        params: {
          integration_id: integrationId,
          organization_id: options.organizationId,
          limit: options.limit?.toString(),
          direction: options.direction,
          status: options.status,
        },
      }),

    /**
     * Send a notification via integration
     */
    sendNotification: (data) =>
      call('send-notification', {
        method: 'POST',
        body: data,
      }),

    /**
     * Publish MQTT message
     */
    publishMqtt: (data) =>
      call('mqtt-broker', {
        method: 'POST',
        body: {
          ...data,
          action: 'publish',
        },
      }),

    /**
     * Subscribe to MQTT topic
     */
    subscribeMqtt: (data) =>
      call('mqtt-broker', {
        method: 'POST',
        body: {
          ...data,
          action: 'subscribe',
        },
      }),
  }
}
