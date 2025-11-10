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
    limit: z.string().transform((val) => parseInt(val, 10)).pipe(
      z.number().int().min(1).max(500)
    ).optional(),
    offset: z.string().transform((val) => parseInt(val, 10)).pipe(
      z.number().int().min(0)
    ).optional(),
  },

  // Status types
  deviceStatus: z.enum(['online', 'offline', 'unknown', 'maintenance']),
  alertStatus: z.enum(['new', 'acknowledged', 'resolved']),
  integrationStatus: z.enum(['active', 'inactive', 'error', 'testing']),
  
  // User roles
  userRole: z.enum(['super_admin', 'org_owner', 'org_admin', 'user', 'viewer']),
}

// ===========================================================================
// Device Schemas
// ===========================================================================

export const deviceSchemas = {
  create: z.object({
    name: z.string().min(1, 'Device name is required'),
    device_type: z.string().optional(),
    organization_id: schemas.organizationId,
    location_id: schemas.uuid.optional(),
    department_id: schemas.uuid.optional(),
    integration_id: schemas.uuid.optional(),
    external_device_id: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
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
    device_id: schemas.deviceId.optional(),
    organization_id: schemas.organizationId,
    metadata: z.record(z.unknown()).optional(),
  }),

  update: z.object({
    is_resolved: z.boolean().optional(),
    resolved_at: z.string().datetime().optional(),
    resolved_by: schemas.userId.optional(),
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
export function validateSearchParams<T>(
  url: URL,
  schema: z.ZodSchema<T>
): T {
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
    throw new ValidationError(`Missing required path parameter: ${paramName}`, [])
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
export function parseIntParam(value: string | null, defaultValue: number = 0): number {
  if (!value) return defaultValue
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? defaultValue : parsed
}

/**
 * Safe boolean param parsing
 */
export function parseBooleanParam(value: string | null, defaultValue: boolean = false): boolean {
  if (!value) return defaultValue
  return value === 'true' || value === '1'
}
