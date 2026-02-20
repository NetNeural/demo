// Jest setup file
import '@testing-library/jest-dom'

// Add fetch polyfill for Node.js test environment with default 404 response
global.fetch = jest.fn((url, options) => {
  // Default mock response for unmocked fetch calls
  return Promise.resolve({
    ok: false,
    status: 404,
    statusText: 'Not Found',
    json: async () => ({ error: 'Mock endpoint not implemented' }),
    text: async () => 'Mock endpoint not implemented',
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: url,
  })
})

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      refresh: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: '/',
      query: {},
    }
  },
  usePathname() {
    return '/'
  },
  useSearchParams() {
    return new URLSearchParams()
  },
}))

// Mock Supabase client with proper chaining support
const createMockQueryBuilder = () => {
  const mockBuilder = {
    select: jest.fn(() => mockBuilder),
    eq: jest.fn(() => mockBuilder),
    neq: jest.fn(() => mockBuilder),
    gt: jest.fn(() => mockBuilder),
    gte: jest.fn(() => mockBuilder),
    lt: jest.fn(() => mockBuilder),
    lte: jest.fn(() => mockBuilder),
    like: jest.fn(() => mockBuilder),
    ilike: jest.fn(() => mockBuilder),
    is: jest.fn(() => mockBuilder),
    in: jest.fn(() => mockBuilder),
    contains: jest.fn(() => mockBuilder),
    containedBy: jest.fn(() => mockBuilder),
    rangeGt: jest.fn(() => mockBuilder),
    rangeGte: jest.fn(() => mockBuilder),
    rangeLt: jest.fn(() => mockBuilder),
    rangeLte: jest.fn(() => mockBuilder),
    rangeAdjacent: jest.fn(() => mockBuilder),
    overlaps: jest.fn(() => mockBuilder),
    textSearch: jest.fn(() => mockBuilder),
    match: jest.fn(() => mockBuilder),
    not: jest.fn(() => mockBuilder),
    or: jest.fn(() => mockBuilder),
    filter: jest.fn(() => mockBuilder),
    order: jest.fn(() => mockBuilder),
    limit: jest.fn(() => mockBuilder),
    range: jest.fn(() => mockBuilder),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    then: jest.fn((resolve) => resolve({ data: [], error: null })),
  }
  return mockBuilder
}

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest
        .fn()
        .mockResolvedValue({ data: { user: null }, error: null }),
      getSession: jest
        .fn()
        .mockResolvedValue({ data: { session: null }, error: null }),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      updateUser: jest.fn(),
      setSession: jest.fn(),
    },
    from: jest.fn(() => {
      const builder = createMockQueryBuilder()
      builder.update = jest.fn(() => createMockQueryBuilder())
      builder.insert = jest.fn().mockResolvedValue({ data: null, error: null })
      builder.delete = jest.fn(() => createMockQueryBuilder())
      builder.upsert = jest.fn().mockResolvedValue({ data: null, error: null })
      return builder
    }),
  })),
}))

// Mock Sentry module - using manual mock instead of jest.mock in setup
// Tests can import from '@sentry/nextjs' and will get these mocks

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return []
  }
  unobserve() {}
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
}

// Suppress console errors in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
}
