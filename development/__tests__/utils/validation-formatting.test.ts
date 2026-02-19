/**
 * Comprehensive Tests for Data Validation and Formatting Utilities
 * 
 * Tests for validation functions, formatters, and data transformations
 */

describe('Email Validation', () => {
  const isValidEmail = (email: string): boolean => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return regex.test(email)
  }

  test('validates correct email addresses', () => {
    expect(isValidEmail('user@example.com')).toBe(true)
    expect(isValidEmail('test.user@domain.co.uk')).toBe(true)
    expect(isValidEmail('email+tag@service.com')).toBe(true)
  })

  test('rejects invalid email addresses', () => {
    expect(isValidEmail('notanemail')).toBe(false)
    expect(isValidEmail('@example.com')).toBe(false)
    expect(isValidEmail('user@')).toBe(false)
    expect(isValidEmail('user @example.com')).toBe(false)
  })
})

describe('UUID Validation', () => {
  const isValidUUID = (uuid: string): boolean => {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return regex.test(uuid)
  }

  test('validates correct UUIDs', () => {
    expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true)
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  test('rejects invalid UUIDs', () => {
    expect(isValidUUID('not-a-uuid')).toBe(false)
    expect(isValidUUID('123e4567-e89b-12d3-a456')).toBe(false)
    expect(isValidUUID('123e4567e89b12d3a456426614174000')).toBe(false)
  })
})

describe('Phone Number Formatting', () => {
  const formatPhoneNumber = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    }
    return phone
  }

  test('formats 10-digit phone numbers', () => {
    expect(formatPhoneNumber('1234567890')).toBe('(123) 456-7890')
    expect(formatPhoneNumber('9876543210')).toBe('(987) 654-3210')
  })

  test('returns original for invalid phone numbers', () => {
    expect(formatPhoneNumber('12345')).toBe('12345')
    expect(formatPhoneNumber('abc')).toBe('abc')
  })
})

describe('Currency Formatting', () => {
  const formatCurrency = (amount: number, currency: string = 'USD'): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount)
  }

  test('formats USD correctly', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56')
    expect(formatCurrency(0)).toBe('$0.00')
    expect(formatCurrency(1000000)).toBe('$1,000,000.00')
  })

  test('handles negative amounts', () => {
    const result = formatCurrency(-50.25)
    expect(result).toMatch(/-?\$50\.25/)
  })
})

describe('Percentage Formatting', () => {
  const formatPercentage = (value: number, decimals: number = 1): string => {
    return `${value.toFixed(decimals)}%`
  }

  test('formats percentages with decimals', () => {
    expect(formatPercentage(75.5)).toBe('75.5%')
    expect(formatPercentage(100, 0)).toBe('100%')
    expect(formatPercentage(33.333, 2)).toBe('33.33%')
  })

  test('handles zero and negative values', () => {
    expect(formatPercentage(0)).toBe('0.0%')
    expect(formatPercentage(-5.5)).toBe('-5.5%')
  })
})

describe('String Truncation', () => {
  const truncate = (str: string, maxLength: number, suffix: string = '...'): string => {
    if (str.length <= maxLength) return str
    return str.substring(0, maxLength - suffix.length) + suffix
  }

  test('truncates long strings', () => {
    expect(truncate('This is a very long string', 10)).toBe('This is...')
    expect(truncate('Short', 10)).toBe('Short')
  })

  test('uses custom suffix', () => {
    expect(truncate('Long string here', 10, '…')).toBe('Long stri…')
  })
})

describe('Array Deduplication', () => {
  test('removes duplicate primitives', () => {
    const arr = [1, 2, 2, 3, 3, 3, 4]
    const unique = [...new Set(arr)]
    
    expect(unique).toEqual([1, 2, 3, 4])
  })

  test('removes duplicate strings', () => {
    const arr = ['a', 'b', 'a', 'c', 'b']
    const unique = [...new Set(arr)]
    
    expect(unique).toEqual(['a', 'b', 'c'])
  })

  test('deduplicates objects by key', () => {
    const arr = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
      { id: 1, name: 'C' },
    ]
    const unique = arr.filter((item, index, self) =>
      index === self.findIndex(t => t.id === item.id)
    )
    
    expect(unique).toHaveLength(2)
    expect(unique[0].name).toBe('A')
    expect(unique[1].name).toBe('B')
  })
})

describe('Deep Clone Objects', () => {
  test('creates independent copy of object', () => {
    const original = { a: 1, b: { c: 2 } }
    const clone = JSON.parse(JSON.stringify(original))
    
    clone.b.c = 3
    
    expect(original.b.c).toBe(2)
    expect(clone.b.c).toBe(3)
  })

  test('clones arrays', () => {
    const original = [1, 2, [3, 4]]
    const clone = JSON.parse(JSON.stringify(original))
    
    clone[2][0] = 99
    
    expect(original[2][0]).toBe(3)
    expect(clone[2][0]).toBe(99)
  })
})

describe('Merge Objects', () => {
  test('merges two objects', () => {
    const obj1 = { a: 1, b: 2 }
    const obj2 = { b: 3, c: 4 }
    const merged = { ...obj1, ...obj2 }
    
    expect(merged).toEqual({ a: 1, b: 3, c: 4 })
  })

  test('deep merges nested objects', () => {
    const deepMerge = (target: any, source: any): any => {
      const output = { ...target }
      if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
          if (isObject(source[key])) {
            if (!(key in target)) {
              output[key] = source[key]
            } else {
              output[key] = deepMerge(target[key], source[key])
            }
          } else {
            output[key] = source[key]
          }
        })
      }
      return output
    }

    const isObject = (item: any): boolean => {
      return item && typeof item === 'object' && !Array.isArray(item)
    }

    const obj1 = { a: { x: 1, y: 2 }, b: 3 }
    const obj2 = { a: { y: 3, z: 4 }, c: 5 }
    const merged = deepMerge(obj1, obj2)
    
    expect(merged).toEqual({ a: { x: 1, y: 3, z: 4 }, b: 3, c: 5 })
  })
})

describe('Sort Arrays', () => {
  test('sorts numbers ascending', () => {
    const arr = [3, 1, 4, 1, 5, 9, 2, 6]
    const sorted = [...arr].sort((a, b) => a - b)
    
    expect(sorted).toEqual([1, 1, 2, 3, 4, 5, 6, 9])
  })

  test('sorts numbers descending', () => {
    const arr = [3, 1, 4, 1, 5, 9, 2, 6]
    const sorted = [...arr].sort((a, b) => b - a)
    
    expect(sorted).toEqual([9, 6, 5, 4, 3, 2, 1, 1])
  })

  test('sorts strings alphabetically', () => {
    const arr = ['banana', 'apple', 'cherry', 'date']
    const sorted = [...arr].sort()
    
    expect(sorted).toEqual(['apple', 'banana', 'cherry', 'date'])
  })

  test('sorts objects by property', () => {
    const arr = [
      { name: 'Bob', age: 30 },
      { name: 'Alice', age: 25 },
      { name: 'Charlie', age: 35 },
    ]
    const sorted = [...arr].sort((a, b) => a.age - b.age)
    
    expect(sorted[0].name).toBe('Alice')
    expect(sorted[2].name).toBe('Charlie')
  })
})

describe('Pagination', () => {
  test('calculates total pages', () => {
    const getTotalPages = (totalItems: number, itemsPerPage: number): number => {
      return Math.ceil(totalItems / itemsPerPage)
    }
    
    expect(getTotalPages(100, 10)).toBe(10)
    expect(getTotalPages(95, 10)).toBe(10)
    expect(getTotalPages(101, 10)).toBe(11)
  })

  test('slices array for page', () => {
    const data = Array.from({ length: 100 }, (_, i) => i + 1)
    const page = 3
    const pageSize = 10
    const start = (page - 1) * pageSize
    const pageData = data.slice(start, start + pageSize)
    
    expect(pageData).toHaveLength(10)
    expect(pageData[0]).toBe(21)
    expect(pageData[9]).toBe(30)
  })

  test('handles last page with fewer items', () => {
    const data = Array.from({ length: 95 }, (_, i) => i + 1)
    const page = 10
    const pageSize = 10
    const start = (page - 1) * pageSize
    const pageData = data.slice(start, start + pageSize)
    
    expect(pageData).toHaveLength(5)
    expect(pageData[0]).toBe(91)
    expect(pageData[4]).toBe(95)
  })
})

describe('Search and Filter', () => {
  const data = [
    { id: 1, name: 'Apple', category: 'fruit' },
    { id: 2, name: 'Banana', category: 'fruit' },
    { id: 3, name: 'Carrot', category: 'vegetable' },
  ]

  test('filters by exact match', () => {
    const filtered = data.filter(item => item.category === 'fruit')
    
    expect(filtered).toHaveLength(2)
  })

  test('searches by partial string', () => {
    const query = 'an'
    const results = data.filter(item =>
      item.name.toLowerCase().includes(query.toLowerCase())
    )
    
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('Banana')
  })

  test('case-insensitive search', () => {
    const query = 'APPLE'
    const results = data.filter(item =>
      item.name.toLowerCase().includes(query.toLowerCase())
    )
    
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('Apple')
  })
})

describe('Debounce Function', () => {
  jest.useFakeTimers()

  test('delays function execution', () => {
    const func = jest.fn()
    const debounced = debounce(func, 300)
    
    debounced()
    debounced()
    debounced()
    
    expect(func).not.toHaveBeenCalled()
    
    jest.advanceTimersByTime(300)
    
    expect(func).toHaveBeenCalledTimes(1)
  })

  function debounce(func: Function, wait: number) {
    let timeout: NodeJS.Timeout
    return function(...args: any[]) {
      clearTimeout(timeout)
      timeout = setTimeout(() => func(...args), wait)
    }
  }

  jest.useRealTimers()
})
