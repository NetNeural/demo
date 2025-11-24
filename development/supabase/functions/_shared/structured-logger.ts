// ===========================================================================
// Structured Logger - Production-Ready Logging
// ===========================================================================
// Provides JSON-structured logging for all integration operations
// Enables log aggregation, searching, filtering, and monitoring
// ===========================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export interface LogContext {
  service: string
  integrationId?: string
  organizationId?: string
  integrationId?: string
  requestId?: string
  userId?: string
  deviceId?: string
  [key: string]: unknown
}

export interface LogEntry {
  level: LogLevel
  event: string
  timestamp: string
  message?: string
  context: LogContext
  data?: Record<string, unknown>
  error?: {
    message: string
    stack?: string
    name: string
    code?: string
  }
}

/**
 * Structured Logger
 * 
 * Outputs JSON-formatted logs that can be:
 * - Searched by field (integrationId, requestId, etc.)
 * - Filtered by level (error, warn, info)
 * - Aggregated in monitoring tools (DataDog, Sentry, CloudWatch)
 * - Parsed by log shippers
 * 
 * Usage:
 * ```typescript
 * const logger = new StructuredLogger({
 *   service: 'device-sync',
 *   integrationId: '123',
 *   requestId: crypto.randomUUID()
 * })
 * 
 * logger.info('sync_started', { deviceCount: 10 })
 * logger.error('sync_failed', error, { deviceId: 'abc' })
 * ```
 */
export class StructuredLogger {
  constructor(private context: LogContext) {
    // Generate request ID if not provided
    if (!this.context.requestId) {
      this.context.requestId = crypto.randomUUID()
    }
  }

  /**
   * Log debug information (development only)
   */
  debug(event: string, data?: Record<string, unknown>, message?: string): void {
    this.log('debug', event, message, data)
  }

  /**
   * Log informational messages
   */
  info(event: string, data?: Record<string, unknown>, message?: string): void {
    this.log('info', event, message, data)
  }

  /**
   * Log warnings (non-fatal issues)
   */
  warn(event: string, data?: Record<string, unknown>, message?: string): void {
    this.log('warn', event, message, data)
  }

  /**
   * Log errors (recoverable failures)
   */
  error(event: string, error: Error | string, data?: Record<string, unknown>): void {
    const errorObj = typeof error === 'string' 
      ? new Error(error)
      : error

    this.log('error', event, errorObj.message, data, {
      message: errorObj.message,
      stack: errorObj.stack,
      name: errorObj.name,
      code: (errorObj as any).code,
    })
  }

  /**
   * Log fatal errors (unrecoverable failures)
   */
  fatal(event: string, error: Error | string, data?: Record<string, unknown>): void {
    const errorObj = typeof error === 'string' 
      ? new Error(error)
      : error

    this.log('fatal', event, errorObj.message, data, {
      message: errorObj.message,
      stack: errorObj.stack,
      name: errorObj.name,
      code: (errorObj as any).code,
    })
  }

  /**
   * Create child logger with additional context
   */
  child(additionalContext: Partial<LogContext>): StructuredLogger {
    return new StructuredLogger({
      ...this.context,
      ...additionalContext,
    })
  }

  /**
   * Update context for subsequent logs
   */
  setContext(updates: Partial<LogContext>): void {
    Object.assign(this.context, updates)
  }

  /**
   * Get current request ID
   */
  getRequestId(): string {
    return this.context.requestId || ''
  }

  /**
   * Internal log method
   */
  private log(
    level: LogLevel,
    event: string,
    message?: string,
    data?: Record<string, unknown>,
    error?: LogEntry['error']
  ): void {
    const entry: LogEntry = {
      level,
      event,
      timestamp: new Date().toISOString(),
      context: this.context,
    }

    if (message) entry.message = message
    if (data) entry.data = data
    if (error) entry.error = error

    // Output to appropriate console method
    const logMethod = this.getConsoleMethod(level)
    logMethod(JSON.stringify(entry))
  }

  /**
   * Get appropriate console method for log level
   */
  private getConsoleMethod(level: LogLevel): typeof console.log {
    switch (level) {
      case 'debug':
        return console.debug
      case 'info':
        return console.log
      case 'warn':
        return console.warn
      case 'error':
      case 'fatal':
        return console.error
      default:
        return console.log
    }
  }
}

/**
 * Create logger for edge functions
 * Automatically includes function name and request metadata
 */
export function createEdgeFunctionLogger(
  functionName: string,
  req: Request,
  additionalContext?: Partial<LogContext>
): StructuredLogger {
  const url = new URL(req.url)
  
  return new StructuredLogger({
    service: functionName,
    requestId: req.headers.get('x-request-id') || crypto.randomUUID(),
    ...additionalContext,
  })
}

/**
 * Create logger for integration operations
 * Automatically includes integration and organization IDs
 */
export function createIntegrationLogger(
  integrationType: string,
  integrationId: string,
  organizationId: string,
  additionalContext?: Partial<LogContext>
): StructuredLogger {
  return new StructuredLogger({
    service: `integration-${integrationType}`,
    integrationId,
    organizationId,
    ...additionalContext,
  })
}

/**
 * Sanitize sensitive data from logs
 * Removes API keys, passwords, tokens, etc.
 */
export function sanitizeLogData(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}
  const sensitiveKeys = [
    'apiKey',
    'api_key',
    'password',
    'token',
    'secret',
    'authorization',
    'auth',
    'credentials',
    'accessKey',
    'secretKey',
  ]

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase()
    
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeLogData(value as Record<string, unknown>)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * Format error for logging
 * Extracts useful information from Error objects
 */
export function formatError(error: unknown): {
  message: string
  stack?: string
  name: string
  code?: string
  details?: unknown
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: (error as any).code,
      details: (error as any).details,
    }
  }

  if (typeof error === 'string') {
    return {
      message: error,
      name: 'Error',
    }
  }

  return {
    message: 'Unknown error',
    name: 'UnknownError',
    details: error,
  }
}

/**
 * Performance timer for logging operation duration
 */
export class PerformanceTimer {
  private startTime: number

  constructor(private logger: StructuredLogger, private operation: string) {
    this.startTime = Date.now()
    this.logger.debug(`${operation}_started`, { startTime: this.startTime })
  }

  /**
   * End timer and log duration
   */
  end(data?: Record<string, unknown>): number {
    const duration = Date.now() - this.startTime
    this.logger.info(`${this.operation}_completed`, {
      duration_ms: duration,
      ...data,
    })
    return duration
  }

  /**
   * End timer with error
   */
  endWithError(error: Error, data?: Record<string, unknown>): number {
    const duration = Date.now() - this.startTime
    this.logger.error(`${this.operation}_failed`, error, {
      duration_ms: duration,
      ...data,
    })
    return duration
  }
}
