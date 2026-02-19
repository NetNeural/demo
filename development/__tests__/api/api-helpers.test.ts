/**
 * Comprehensive Tests for Form Validation and API Helpers
 * 
 * Tests for form validation logic, API request/response handling, and error management
 */

describe('Form Validation - Device Configuration', () => {
  interface DeviceForm {
    name: string
    deviceType: string
    location?: string
    description?: string
  }

  const validateDeviceForm = (data: DeviceForm): { isValid: boolean; errors: string[] } => {
    const errors: string[] = []

    if (!data.name || data.name.trim().length === 0) {
      errors.push('Device name is required')
    }

    if (data.name && data.name.length > 100) {
      errors.push('Device name must be less than 100 characters')
    }

    if (!data.deviceType) {
      errors.push('Device type is required')
    }

    if (data.location && data.location.length > 200) {
      errors.push('Location must be less than 200 characters')
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  test('validates valid device form', () => {
    const form: DeviceForm = {
      name: 'Temperature Sensor A',
      deviceType: 'sensor',
      location: 'Room 101',
    }

    const result = validateDeviceForm(form)

    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  test('rejects empty device name', () => {
    const form: DeviceForm = {
      name: '',
      deviceType: 'sensor',
    }

    const result = validateDeviceForm(form)

    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Device name is required')
  })

  test('rejects missing device type', () => {
    const form: DeviceForm = {
      name: 'Sensor',
      deviceType: '',
    }

    const result = validateDeviceForm(form)

    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Device type is required')
  })

  test('rejects name exceeding max length', () => {
    const form: DeviceForm = {
      name: 'A'.repeat(101),
      deviceType: 'sensor',
    }

    const result = validateDeviceForm(form)

    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Device name must be less than 100 characters')
  })
})

describe('Form Validation - User Registration', () => {
  interface UserForm {
    email: string
    password: string
    confirmPassword: string
    fullName: string
  }

  const validateUserForm = (data: UserForm): { isValid: boolean; errors: Record<string, string> } => {
    const errors: Record<string, string> = {}

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!data.email) {
      errors.email = 'Email is required'
    } else if (!emailRegex.test(data.email)) {
      errors.email = 'Invalid email format'
    }

    // Password validation
    if (!data.password) {
      errors.password = 'Password is required'
    } else if (data.password.length < 8) {
      errors.password = 'Password must be at least 8 characters'
    }

    // Confirm password
    if (data.password !== data.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match'
    }

    // Full name
    if (!data.fullName || data.fullName.trim().length === 0) {
      errors.fullName = 'Full name is required'
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    }
  }

  test('validates valid user registration', () => {
    const form: UserForm = {
      email: 'user@example.com',
      password: 'SecurePass123',
      confirmPassword: 'SecurePass123',
      fullName: 'John Doe',
    }

    const result = validateUserForm(form)

    expect(result.isValid).toBe(true)
    expect(Object.keys(result.errors)).toHaveLength(0)
  })

  test('rejects invalid email', () => {
    const form: UserForm = {
      email: 'invalid-email',
      password: 'password123',
      confirmPassword: 'password123',
      fullName: 'John Doe',
    }

    const result = validateUserForm(form)

    expect(result.isValid).toBe(false)
    expect(result.errors.email).toBe('Invalid email format')
  })

  test('rejects short password', () => {
    const form: UserForm = {
      email: 'user@example.com',
      password: 'short',
      confirmPassword: 'short',
      fullName: 'John Doe',
    }

    const result = validateUserForm(form)

    expect(result.isValid).toBe(false)
    expect(result.errors.password).toBe('Password must be at least 8 characters')
  })

  test('rejects mismatched passwords', () => {
    const form: UserForm = {
      email: 'user@example.com',
      password: 'password123',
      confirmPassword: 'different123',
      fullName: 'John Doe',
    }

    const result = validateUserForm(form)

    expect(result.isValid).toBe(false)
    expect(result.errors.confirmPassword).toBe('Passwords do not match')
  })
})

describe('API Response Handling', () => {
  interface ApiResponse<T> {
    data: T | null
    error: string | null
    status: number
  }

  test('handles successful API response', () => {
    const response: ApiResponse<{ id: string; name: string }> = {
      data: { id: '123', name: 'Test' },
      error: null,
      status: 200,
    }

    expect(response.data).not.toBeNull()
    expect(response.error).toBeNull()
    expect(response.status).toBe(200)
  })

  test('handles API error response', () => {
    const response: ApiResponse<any> = {
      data: null,
      error: 'Not found',
      status: 404,
    }

    expect(response.data).toBeNull()
    expect(response.error).toBe('Not found')
    expect(response.status).toBe(404)
  })

  test('extracts error message from response', () => {
    const extractError = (response: ApiResponse<any>): string => {
      return response.error || 'An unknown error occurred'
    }

    const errorResponse: ApiResponse<any> = { data: null, error: 'Server error', status: 500 }
    const successResponse: ApiResponse<any> = { data: {}, error: null, status: 200 }

    expect(extractError(errorResponse)).toBe('Server error')
    expect(extractError(successResponse)).toBe('An unknown error occurred')
  })
})

describe('HTTP Status Code Helpers', () => {
  const isSuccess = (status: number): boolean => status >= 200 && status < 300
  const isClientError = (status: number): boolean => status >= 400 && status < 500
  const isServerError = (status: number): boolean => status >= 500 && status < 600

  test('identifies success status codes', () => {
    expect(isSuccess(200)).toBe(true)
    expect(isSuccess(201)).toBe(true)
    expect(isSuccess(204)).toBe(true)
    expect(isSuccess(400)).toBe(false)
  })

  test('identifies client error status codes', () => {
    expect(isClientError(400)).toBe(true)
    expect(isClientError(404)).toBe(true)
    expect(isClientError(422)).toBe(true)
    expect(isClientError(200)).toBe(false)
  })

  test('identifies server error status codes', () => {
    expect(isServerError(500)).toBe(true)
    expect(isServerError(502)).toBe(true)
    expect(isServerError(403)).toBe(false)
  })
})

describe('Query String Building', () => {
  const buildQueryString = (params: Record<string, any>): string => {
    const entries = Object.entries(params).filter(([_, value]) => value !== undefined && value !== null)
    if (entries.length === 0) return ''
    
    const queryParts = entries.map(([key, value]) => {
      if (Array.isArray(value)) {
        return value.map(v => `${encodeURIComponent(key)}=${encodeURIComponent(v)}`).join('&')
      }
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    })
    
    return '?' + queryParts.join('&')
  }

  test('builds query string from object', () => {
    const params = { page: 1, limit: 10, search: 'test' }
    const queryString = buildQueryString(params)
    
    expect(queryString).toBe('?page=1&limit=10&search=test')
  })

  test('handles empty params', () => {
    const queryString = buildQueryString({})
    
    expect(queryString).toBe('')
  })

  test('filters out null and undefined', () => {
    const params = { page: 1, limit: null, search: undefined, status: 'active' }
    const queryString = buildQueryString(params)
    
    expect(queryString).toBe('?page=1&status=active')
  })

  test('encodes special characters', () => {
    const params = { search: 'test & demo', filter: 'a=b' }
    const queryString = buildQueryString(params)
    
    expect(queryString).toContain('test%20%26%20demo')
    expect(queryString).toContain('a%3Db')
  })
})

describe('Error Message Formatting', () => {
  const formatErrorMessage = (error: unknown): string => {
    if (typeof error === 'string') return error
    if (error instanceof Error) return error.message
    if (typeof error === 'object' && error !== null && 'message' in error) {
      return String(error.message)
    }
    return 'An unexpected error occurred'
  }

  test('formats string errors', () => {
    expect(formatErrorMessage('Something went wrong')).toBe('Something went wrong')
  })

  test('formats Error objects', () => {
    const error = new Error('Test error')
    expect(formatErrorMessage(error)).toBe('Test error')
  })

  test('formats object with message property', () => {
    const error = { message: 'Custom error' }
    expect(formatErrorMessage(error)).toBe('Custom error')
  })

  test('handles unknown error types', () => {
    expect(formatErrorMessage(null)).toBe('An unexpected error occurred')
    expect(formatErrorMessage(undefined)).toBe('An unexpected error occurred')
    expect(formatErrorMessage(123)).toBe('An unexpected error occurred')
  })
})

describe('Retry Logic', () => {
  test('retries failed operations', async () => {
    let attempts = 0
    const operation = jest.fn(async () => {
      attempts++
      if (attempts < 3) throw new Error('Failed')
      return 'Success'
    })

    const retry = async (fn: () => Promise<any>, maxAttempts: number = 3): Promise<any> => {
      let lastError
      for (let i = 0; i < maxAttempts; i++) {
        try {
          return await fn()
        } catch (error) {
          lastError = error
        }
      }
      throw lastError
    }

    const result = await retry(operation, 3)

    expect(result).toBe('Success')
    expect(operation).toHaveBeenCalledTimes(3)
  })

  test('throws after max attempts', async () => {
    const operation = jest.fn(async () => {
      throw new Error('Always fails')
    })

    const retry = async (fn: () => Promise<any>, maxAttempts: number = 3): Promise<any> => {
      let lastError
      for (let i = 0; i < maxAttempts; i++) {
        try {
          return await fn()
        } catch (error) {
          lastError = error
        }
      }
      throw lastError
    }

    await expect(retry(operation, 3)).rejects.toThrow('Always fails')
    expect(operation).toHaveBeenCalledTimes(3)
  })
})

describe('Request Timeout', () => {
  jest.useFakeTimers()

  test('times out long-running requests', async () => {
    const timeout = (ms: number): Promise<never> => {
      return new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), ms)
      })
    }

    const longRequest = new Promise(resolve => setTimeout(() => resolve('Done'), 5000))
    
    const racePromise = Promise.race([longRequest, timeout(1000)])

    jest.advanceTimersByTime(1000)

    await expect(racePromise).rejects.toThrow('Timeout')
  })

  jest.useRealTimers()
})
