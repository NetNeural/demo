/**
 * Tests for src/lib/api-error-handler.ts
 * 
 * Testing API error handling logic
 */

import { handleApiError, isRetryableError, formatApiError } from '@/lib/api-error-handler'

describe('handleApiError', () => {
  describe('Successful responses', () => {
    test('returns no error for 200 OK', () => {
      const response = new Response(null, { status: 200, statusText: 'OK' })
      const result = handleApiError(response, { throwOnError: false })
      
      expect(result.isError).toBe(false)
      expect(result.isAuthError).toBe(false)
      expect(result.statusCode).toBe(200)
    })

    test('returns no error for 201 Created', () => {
      const response = new Response(null, { status: 201, statusText: 'Created' })
      const result = handleApiError(response, { throwOnError: false })
      
      expect(result.isError).toBe(false)
      expect(result.isAuthError).toBe(false)
    })

    test('returns no error for 204 No Content', () => {
      const response = new Response(null, { status: 204, statusText: 'No Content' })
      const result = handleApiError(response, { throwOnError: false })
      
      expect(result.isError).toBe(false)
      expect(result.isAuthError).toBe(false)
    })
  })

  describe('Authentication errors', () => {
    test('identifies 401 Unauthorized as auth error', () => {
      const response = new Response(null, { status: 401, statusText: 'Unauthorized' })
      const result = handleApiError(response, { throwOnError: false })
      
      expect(result.isError).toBe(true)
      expect(result.isAuthError).toBe(true)
      expect(result.statusCode).toBe(401)
    })

    test('identifies 403 Forbidden as auth error', () => {
      const response = new Response(null, { status: 403, statusText: 'Forbidden' })
      const result = handleApiError(response, { throwOnError: false })
      
      expect(result.isError).toBe(true)
      expect(result.isAuthError).toBe(true)
      expect(result.statusCode).toBe(403)
    })

    test('silently handles auth errors by default', () => {
      const response = new Response(null, { status: 401, statusText: 'Unauthorized' })
      
      // Should not throw even though throwOnError is true
      expect(() => {
        handleApiError(response, { throwOnError: true, silentAuthErrors: true })
      }).not.toThrow()
    })

    test('can throw auth errors if configured', () => {
      const response = new Response(null, { status: 401, statusText: 'Unauthorized' })
      
      expect(() => {
        handleApiError(response, { throwOnError: true, silentAuthErrors: false })
      }).toThrow()
    })
  })

  describe('Client errors (4xx)', () => {
    test('identifies 400 Bad Request as error', () => {
      const response = new Response(null, { status: 400, statusText: 'Bad Request' })
      const result = handleApiError(response, { throwOnError: false })
      
      expect(result.isError).toBe(true)
      expect(result.isAuthError).toBe(false)
      expect(result.statusCode).toBe(400)
      expect(result.shouldRetry).toBe(false)
    })

    test('identifies 404 Not Found as error', () => {
      const response = new Response(null, { status: 404, statusText: 'Not Found' })
      const result = handleApiError(response, { throwOnError: false })
      
      expect(result.isError).toBe(true)
      expect(result.isAuthError).toBe(false)
      expect(result.shouldRetry).toBe(false)
    })

    test('identifies 422 Unprocessable Entity as error', () => {
      const response = new Response(null, { status: 422, statusText: 'Unprocessable Entity' })
      const result = handleApiError(response, { throwOnError: false })
      
      expect(result.isError).toBe(true)
      expect(result.statusCode).toBe(422)
    })
  })

  describe('Server errors (5xx)', () => {
    test('identifies 500 Internal Server Error and marks as retryable', () => {
      const response = new Response(null, { status: 500, statusText: 'Internal Server Error' })
      const result = handleApiError(response, { throwOnError: false })
      
      expect(result.isError).toBe(true)
      expect(result.isAuthError).toBe(false)
      expect(result.statusCode).toBe(500)
      expect(result.shouldRetry).toBe(true)
    })

    test('identifies 502 Bad Gateway and marks as retryable', () => {
      const response = new Response(null, { status: 502, statusText: 'Bad Gateway' })
      const result = handleApiError(response, { throwOnError: false })
      
      expect(result.isError).toBe(true)
      expect(result.shouldRetry).toBe(true)
    })

    test('identifies 503 Service Unavailable and marks as retryable', () => {
      const response = new Response(null, { status: 503, statusText: 'Service Unavailable' })
      const result = handleApiError(response, { throwOnError: false })
      
      expect(result.isError).toBe(true)
      expect(result.shouldRetry).toBe(true)
    })
  })

  describe('Throw behavior', () => {
    test('throws error when throwOnError is true', () => {
      const response = new Response(null, { status: 500, statusText: 'Internal Server Error' })
      
      expect(() => {
        handleApiError(response, { throwOnError: true })
      }).toThrow()
    })

    test('does not throw when throwOnError is false', () => {
      const response = new Response(null, { status: 500, statusText: 'Internal Server Error' })
      
      expect(() => {
        handleApiError(response, { throwOnError: false })
      }).not.toThrow()
    })

    test('includes custom error prefix in thrown error', () => {
      const response = new Response(null, { status: 500, statusText: 'Internal Server Error' })
      
      expect(() => {
        handleApiError(response, {
          throwOnError: true,
          errorPrefix: 'Failed to load devices',
        })
      }).toThrow(/Failed to load devices/)
    })
  })

  describe('Logging behavior', () => {
    let consoleErrorSpy: jest.SpyInstance
    let consoleLogSpy: jest.SpyInstance

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    })

    afterEach(() => {
      consoleErrorSpy.mockRestore()
      consoleLogSpy.mockRestore()
    })

    test('logs errors when logErrors is true', () => {
      const response = new Response(null, { status: 500, statusText: 'Internal Server Error' })
      
      handleApiError(response, { throwOnError: false, logErrors: true })
      
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    test('does not log when logErrors is false', () => {
      const response = new Response(null, { status: 500, statusText: 'Internal Server Error' })
      
      handleApiError(response, { throwOnError: false, logErrors: false })
      
      expect(consoleErrorSpy).not.toHaveBeenCalled()
      expect(consoleLogSpy).not.toHaveBeenCalled()
    })

    test('logs auth errors to console.log instead of console.error', () => {
      const response = new Response(null, { status: 401, statusText: 'Unauthorized' })
      
      handleApiError(response, { throwOnError: false, logErrors: true })
      
      expect(consoleLogSpy).toHaveBeenCalled()
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })
  })
})

describe('isRetryableError', () => {
  test('returns true for 500 errors', () => {
    expect(isRetryableError(500)).toBe(true)
  })

  test('returns true for 502 errors', () => {
    expect(isRetryableError(502)).toBe(true)
  })

  test('returns true for 503 errors', () => {
    expect(isRetryableError(503)).toBe(true)
  })

  test('returns true for 504 errors', () => {
    expect(isRetryableError(504)).toBe(true)
  })

  test('returns false for 4xx errors', () => {
    expect(isRetryableError(400)).toBe(false)
    expect(isRetryableError(404)).toBe(false)
    expect(isRetryableError(422)).toBe(false)
  })

  test('returns false for 2xx success', () => {
    expect(isRetryableError(200)).toBe(false)
    expect(isRetryableError(201)).toBe(false)
  })

  test('returns false for auth errors', () => {
    expect(isRetryableError(401)).toBe(false)
    expect(isRetryableError(403)).toBe(false)
  })
})

describe('formatApiError', () => {
  test('formats error with status and message', () => {
    const result = formatApiError(500, 'Internal Server Error', 'Failed to fetch data')
    
    expect(result).toContain('500')
    expect(result).toContain('Internal Server Error')
    expect(result).toContain('Failed to fetch data')
  })

  test('handles missing error prefix', () => {
    const result = formatApiError(404, 'Not Found')
    
    expect(result).toContain('404')
    expect(result).toContain('Not Found')
  })

  test('formats auth errors differently', () => {
    const result = formatApiError(401, 'Unauthorized', 'Access denied')
    
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('Edge cases and integration', () => {
  test('handles malformed Response objects gracefully', () => {
    const response = new Response(null, { status: undefined as any })
    
    expect(() => {
      handleApiError(response, { throwOnError: false })
    }).not.toThrow()
  })

  test('handles custom status codes', () => {
    const response = new Response(null, { status: 418, statusText: "I'm a teapot" })
    const result = handleApiError(response, { throwOnError: false })
    
    expect(result.isError).toBe(true)
    expect(result.statusCode).toBe(418)
  })

  test('combines all options correctly', () => {
    const response = new Response(null, { status: 500, statusText: 'Error' })
    
    const result = handleApiError(response, {
      throwOnError: false,
      logErrors: false,
      errorPrefix: 'Custom error',
      silentAuthErrors: false,
    })
    
    expect(result.isError).toBe(true)
    expect(result.statusCode).toBe(500)
    expect(result.shouldRetry).toBe(true)
  })
})
