// ===========================================================================
// Validation Utilities - Zod-based Request Validation
// ===========================================================================
// Common validation schemas and helpers for edge functions
// ===========================================================================

import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

// ===========================================================================
// Common Validation Schemas
// ===========================================================================

export const schemas = {
  // Basic types
  email: z.string().email('Invalid email format'),
  uuid: z.string().uuid('Invalid UUID format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  url: z.string().url('Invalid URL format'),

  // Entity IDs
  organizationId: z.string().uuid('Invalid organization ID'),
  integrationId: z.string().uuid('Invalid integration ID'),
  deviceId: z.string().uuid('Invalid device ID'),
  userId: z.string().uuid('Invalid user ID'),
  alertId: z.string().uuid('Invalid alert ID'),

  // Pagination
  pagination: z.object({
    limit: z.number().int().min(1).max(500).default(50),
    offset: z.number().int().min(0).default(0),
  }),

  // Common query params
  queryParams: {
    organizationId: z.string().uuid().optional(),
    limit: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().min(1).max(500))
      .optional(),
    offset: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().min(0))
      .optional(),
  },

  // Status types
  deviceStatus: z.enum(['online', 'offline', 'unknown', 'maintenance']),
  alertStatus: z.enum(['new', 'acknowledged', 'resolved']),
  integrationStatus: z.enum(['active', 'inactive', 'error', 'testing']),

  // User roles
  userRole: z.enum(['super_admin', 'platform_admin', 'org_owner', 'org_admin', 'user', 'viewer']),
}

// ===========================================================================
// Device Schemas
// ===========================================================================

export const deviceSchemas = {
  create: z.object({
    name: z.string().min(1, 'Device name is required'),
    device_type: z.string().min(1, 'Device type is required'),
    organization_id: schemas.organizationId.optional(),
    device_id: z.string().optional(), // external_device_id alias
    device_type_id: schemas.uuid.optional(),
    model: z.string().optional(),
    serial_number: z.string().optional(),
    firmware_version: z.string().optional(),
    location_id: schemas.uuid.nullable().optional(),
    location: z.string().optional(),
    department_id: schemas.uuid.optional(),
    integration_id: schemas.uuid.optional(),
    metadata: z.record(z.unknown()).optional(),
    is_test_device: z.boolean().optional(),
    status: schemas.deviceStatus.optional(),
    battery_level: z.number().min(0).max(100).optional(),
    signal_strength: z.number().optional(),
  }),

  update: z.object({
    name: z.string().min(1).optional(),
    device_type: z.string().optional(),
    status: schemas.deviceStatus.optional(),
    location_id: schemas.uuid.nullable().optional(),
    department_id: schemas.uuid.nullable().optional(),
    battery_level: z.number().min(0).max(100).optional(),
    signal_strength: z.number().optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
}

// ===========================================================================
// Integration Schemas
// ===========================================================================

export const integrationSchemas = {
  create: z.object({
    name: z.string().min(1, 'Integration name is required'),
    integration_type: z.string().min(1, 'Integration type is required'),
    organization_id: schemas.organizationId,
    settings: z.record(z.unknown()),
    webhook_enabled: z.boolean().optional(),
    webhook_url: z.string().url().optional(),
    webhook_secret: z.string().optional(),
  }),

  update: z.object({
    name: z.string().min(1).optional(),
    status: schemas.integrationStatus.optional(),
    settings: z.record(z.unknown()).optional(),
    webhook_enabled: z.boolean().optional(),
    webhook_url: z.string().url().optional(),
    webhook_secret: z.string().optional(),
  }),

  test: z.object({
    integration_type: z.string(),
    settings: z.record(z.unknown()),
    organization_id: schemas.organizationId,
  }),
}

// ===========================================================================
// User Schemas
// ===========================================================================

export const userSchemas = {
  create: z.object({
    email: schemas.email,
    password: schemas.password,
    fullName: z.string().min(1, 'Full name is required'),
    role: schemas.userRole.optional(),
    organizationRole: z.string().optional(),
    organizationId: schemas.organizationId.optional(),
    organization_id: schemas.organizationId.optional(),
  }),

  update: z.object({
    full_name: z.string().min(1).optional(),
    role: schemas.userRole.optional(),
    organization_id: schemas.organizationId.nullable().optional(),
  }),
}

// ===========================================================================
// Alert Schemas
// ===========================================================================

export const alertSchemas = {
  create: z.object({
    title: z.string().min(1, 'Alert title is required'),
    message: z.string().min(1, 'Alert message is required'),
    severity: z.enum(['info', 'warning', 'error', 'critical']),
    alert_type: z.string(),
    device_id: schemas.deviceId,
    organization_id: schemas.organizationId,
    category: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  }),

  update: z.object({
    is_resolved: z.boolean().optional(),
    resolved_at: z.string().datetime().optional(),
    resolved_by: schemas.userId.optional(),
  }),
}

// ===========================================================================
// Organization Schemas
// ===========================================================================

export const organizationSchemas = {
  create: z.object({
    name: z.string().min(1, 'name is required'),
    slug: z
      .string()
      .min(1, 'slug is required')
      .regex(
        /^[a-z0-9-]+$/,
        'Slug can only contain lowercase letters, numbers, and hyphens'
      ),
    description: z.string().optional(),
    subscriptionTier: z.string().optional(),
    parentOrganizationId: z.string().uuid().optional(),
    ownerEmail: z.string().email().optional(),
    ownerFullName: z.string().optional(),
    sendWelcomeEmail: z.boolean().optional(),
  }),

  update: z.object({
    name: z.string().min(1).optional(),
    slug: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    description: z.string().nullable().optional(),
    subscriptionTier: z.string().optional(),
  }),
}

// ===========================================================================
// Member Schemas
// ===========================================================================

export const memberSchemas = {
  add: z.object({
    email: z.string().email('Invalid email format').optional(),
    userId: z.string().uuid('Invalid user UUID').optional(),
    role: z.enum(['member', 'admin', 'billing', 'viewer', 'owner'], {
      errorMap: () => ({
        message: 'role must be one of: member, admin, billing, viewer, owner',
      }),
    }),
  }),

  update: z.object({
    role: z.enum(['member', 'admin', 'billing', 'viewer', 'owner']).optional(),
  }),
}

// ===========================================================================
// Location Schemas
// ===========================================================================

export const locationSchemas = {
  create: z.object({
    organization_id: schemas.organizationId,
    name: z.string().min(1, 'name is required'),
    description: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    state: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    postal_code: z.string().nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
  }),

  update: z.object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    state: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    postal_code: z.string().nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
  }),
}

// ===========================================================================
// Threshold Schemas
// ===========================================================================

export const thresholdSchemas = {
  create: z.object({
    device_id: schemas.deviceId,
    sensor_type: z.string().min(1, 'sensor_type is required'),
    min_value: z.number().nullable().optional(),
    max_value: z.number().nullable().optional(),
    critical_min: z.number().nullable().optional(),
    critical_max: z.number().nullable().optional(),
    temperature_unit: z.enum(['celsius', 'fahrenheit']).default('celsius'),
    alert_enabled: z.boolean().default(true),
    alert_severity: z
      .enum(['low', 'medium', 'high', 'critical'])
      .default('medium'),
    alert_message: z.string().nullable().optional(),
    notify_on_breach: z.boolean().default(true),
    notification_cooldown_minutes: z.number().int().min(0).default(15),
    notify_user_ids: z.array(z.string()).default([]),
    notify_emails: z.array(z.string().email()).default([]),
    notification_channels: z.array(z.string()).default([]),
  }),

  update: z.object({
    min_value: z.number().nullable().optional(),
    max_value: z.number().nullable().optional(),
    critical_min: z.number().nullable().optional(),
    critical_max: z.number().nullable().optional(),
    temperature_unit: z.enum(['celsius', 'fahrenheit']).optional(),
    alert_enabled: z.boolean().optional(),
    alert_severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    alert_message: z.string().nullable().optional(),
    notify_on_breach: z.boolean().optional(),
    notification_cooldown_minutes: z.number().int().min(0).optional(),
    notify_user_ids: z.array(z.string()).optional(),
    notify_emails: z.array(z.string().email()).optional(),
    notification_channels: z.array(z.string()).optional(),
  }),
}

// ===========================================================================
// Feedback Schemas
// ===========================================================================

export const feedbackSchemas = {
  submit: z.object({
    organizationId: schemas.organizationId,
    type: z.enum(['bug_report', 'feature_request'], {
      errorMap: () => ({
        message: 'type must be "bug_report" or "feature_request"',
      }),
    }),
    title: z.string().min(1, 'title is required'),
    description: z.string().min(1, 'description is required'),
    severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    bugOccurredDate: z.string().optional(),
    bugOccurredTime: z.string().optional(),
    bugTimezone: z.string().optional(),
    screenshotUrls: z.array(z.string().url()).optional(),
    browserInfo: z.string().optional(),
    pageUrl: z.string().optional(),
  }),
}

// ===========================================================================
// Reseller Schemas
// ===========================================================================

export const resellerSchemas = {
  apply: z.object({
    organizationId: schemas.organizationId,
    applicantName: z.string().min(1, 'applicantName is required'),
    applicantEmail: z.string().email('Invalid applicant email'),
    applicantTitle: z.string().optional(),
    applicantPhone: z.string().optional(),
    companyLegalName: z.string().min(1, 'companyLegalName is required'),
    companyAddress: z.string().min(1, 'companyAddress is required'),
    companyWebsite: z.string().optional().or(z.literal('')),
    companyTaxId: z.string().optional(),
    estimatedCustomers: z
      .number()
      .int()
      .min(1, 'estimatedCustomers must be at least 1'),
    targetMarket: z.string().optional(),
    businessModel: z.string().optional(),
    preferredBilling: z.string().optional(),
    additionalNotes: z.string().optional(),
  }),
}

// ===========================================================================
// Alert Rule Schemas
// ===========================================================================

export const alertRuleSchemas = {
  create: z.object({
    organization_id: schemas.organizationId,
    name: z.string().min(1, 'name is required'),
    description: z.string().optional(),
    rule_type: z.enum(['telemetry', 'offline'], {
      errorMap: () => ({ message: 'rule_type must be "telemetry" or "offline"' }),
    }),
    condition: z.object({
      metric: z.string().optional(),
      operator: z.string().optional(),
      value: z.number().optional(),
      duration_minutes: z.number().int().optional(),
      offline_minutes: z.number().int().optional(),
      grace_period_hours: z.number().optional(),
    }),
    device_scope: z.object({
      type: z.enum(['all', 'groups', 'tags', 'specific']),
      values: z.array(z.string()).optional(),
    }),
    actions: z
      .array(
        z.object({
          type: z.enum(['email', 'sms', 'webhook']),
          recipients: z.array(z.string()).optional(),
          webhook_url: z.string().url().optional(),
          message_template: z.string().optional(),
        })
      )
      .min(1, 'At least one action is required'),
    enabled: z.boolean().default(true),
    cooldown_minutes: z.number().int().min(0).default(60),
  }),
}

// ===========================================================================
// Sync Operation Schemas
// ===========================================================================

export const syncSchemas = {
  deviceSync: z.object({
    integrationId: schemas.integrationId,
    organizationId: schemas.organizationId,
    operation: z.enum(['test', 'import', 'export', 'bidirectional']),
    deviceIds: z.array(schemas.deviceId).optional(),
  }),
}

// ===========================================================================
// Validation Helper Functions
// ===========================================================================

/**
 * Validate and parse request body with Zod schema
 */
export async function validateBody<T>(
  req: Request,
  schema: z.ZodSchema<T>
): Promise<T> {
  try {
    const body = await req.json()
    return schema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid request body', error.errors)
    }
    throw error
  }
}

/**
 * Validate URL search params with Zod schema
 */
export function validateSearchParams<T>(url: URL, schema: z.ZodSchema<T>): T {
  const params = Object.fromEntries(url.searchParams)
  try {
    return schema.parse(params)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid query parameters', error.errors)
    }
    throw error
  }
}

/**
 * Validate path parameters
 */
export function validatePathParam(
  value: string | undefined,
  schema: z.ZodSchema,
  paramName: string
): unknown {
  if (!value) {
    throw new ValidationError(
      `Missing required path parameter: ${paramName}`,
      []
    )
  }

  try {
    return schema.parse(value)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(`Invalid ${paramName}`, error.errors)
    }
    throw error
  }
}

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public errors: unknown[]
  ) {
    super(message)
    this.name = 'ValidationError'
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      errors: this.errors,
    }
  }
}

/**
 * Safe string to number conversion with validation
 */
export function parseIntParam(
  value: string | null,
  defaultValue: number = 0
): number {
  if (!value) return defaultValue
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? defaultValue : parsed
}

/**
 * Safe boolean param parsing
 */
export function parseBooleanParam(
  value: string | null,
  defaultValue: boolean = false
): boolean {
  if (!value) return defaultValue
  return value === 'true' || value === '1'
}
