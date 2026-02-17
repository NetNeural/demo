# Testing Guide

## Overview

This document describes the testing strategy, patterns, and best practices for the NetNeural IoT Platform.

## Table of Contents

- [Getting Started](#getting-started)
- [Test Structure](#test-structure)
- [Writing Tests](#writing-tests)
- [Running Tests](#running-tests)
- [Coverage Requirements](#coverage-requirements)
- [Best Practices](#best-practices)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)

## Getting Started

### Prerequisites

```bash
# Install dependencies
npm install

# Verify Jest is configured
npm test -- --version
```

### Quick Start

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- path/to/test.test.tsx

# Run tests matching pattern
npm test -- --testNamePattern="Device"
```

## Test Structure

### Directory Organization

```
__tests__/
├── setup.ts                    # TypeScript test setup
├── utils/
│   └── test-utils.tsx          # Custom render with providers
├── mocks/
│   └── factories.ts            # Mock data factories
├── components/
│   └── *.test.tsx              # Component tests
├── hooks/
│   └── *.test.ts               # Hook tests
├── services/
│   └── *.test.ts               # Service layer tests
└── pages/
    └── *.test.tsx              # Page-level tests
```

### File Naming Conventions

- Unit tests: `*.test.ts` or `*.test.tsx`
- Integration tests: `*.integration.test.ts`
- E2E tests: `*.e2e.test.ts` (separate Playwright setup)

## Writing Tests

### Component Tests

Use the custom `render` function from `test-utils` to automatically wrap components with providers:

```tsx
import { render, screen } from '@/__tests__/utils/test-utils'
import { DeviceCard } from '@/components/devices/DeviceCard'
import { createMockDevice } from '@/__tests__/mocks/factories'

describe('DeviceCard', () => {
  it('renders device information', () => {
    const device = createMockDevice({ name: 'Test Sensor' })
    
    render(<DeviceCard device={device} />)
    
    expect(screen.getByText('Test Sensor')).toBeInTheDocument()
    expect(screen.getByText(/TH-100/)).toBeInTheDocument()
  })
  
  it('shows battery level when available', () => {
    const device = createMockDevice({ battery_level: 85 })
    
    render(<DeviceCard device={device} />)
    
    expect(screen.getByText(/85%/)).toBeInTheDocument()
  })
})
```

### Custom Context Values

Override default context values for specific test scenarios:

```tsx
import { render, screen } from '@/__tests__/utils/test-utils'

render(<AdminPanel />, {
  userValue: {
    isSuperAdmin: true,
    isOrgAdmin: false,
  }
})
```

### Testing User Interactions

Use `userEvent` for realistic user interactions:

```tsx
import { render, screen, userEvent } from '@/__tests__/utils/test-utils'

it('submits form when button clicked', async () => {
  const onSubmit = jest.fn()
  const user = userEvent.setup()
  
  render(<DeviceForm onSubmit={onSubmit} />)
  
  await user.type(screen.getByLabelText('Device Name'), 'New Sensor')
  await user.click(screen.getByRole('button', { name: /submit/i }))
  
  expect(onSubmit).toHaveBeenCalledWith({
    name: 'New Sensor'
  })
})
```

### Hook Tests

Test custom hooks using `renderHook` from React Testing Library:

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { useDevices } from '@/hooks/useDevices'

it('fetches devices on mount', async () => {
  const { result } = renderHook(() => useDevices())
  
  expect(result.current.loading).toBe(true)
  
  await waitFor(() => {
    expect(result.current.loading).toBe(false)
  })
  
  expect(result.current.devices).toHaveLength(5)
})
```

### Testing Async Operations

Use `waitFor` for async state updates:

```tsx
import { render, screen, waitFor } from '@/__tests__/utils/test-utils'

it('loads and displays data', async () => {
  render(<DevicesList />)
  
  expect(screen.getByText(/loading/i)).toBeInTheDocument()
  
  await waitFor(() => {
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
  })
  
  expect(screen.getByText('Device 1')).toBeInTheDocument()
})
```

### Mock Data Factories

Use factory functions for consistent test data:

```tsx
import {
  createMockDevice,
  createMockDevices,
  createMockAlert,
  createMockUser,
  resetMockCounter
} from '@/__tests__/mocks/factories'

describe('DeviceList', () => {
  beforeEach(() => {
    resetMockCounter() // Reset counter for consistent IDs
  })
  
  it('renders multiple devices', () => {
    const devices = createMockDevices(5) // Create 5 devices
    
    render(<DeviceList devices={devices} />)
    
    expect(screen.getAllByRole('article')).toHaveLength(5)
  })
  
  it('handles offline devices', () => {
    const device = createMockDevice({ status: 'offline' })
    
    render(<DeviceCard device={device} />)
    
    expect(screen.getByText(/offline/i)).toBeInTheDocument()
  })
})
```

### Mocking Supabase

Supabase client is automatically mocked in `jest.setup.js`. Override for specific tests:

```tsx
import { createClient } from '@/lib/supabase/client'

jest.mock('@/lib/supabase/client')

it('fetches devices from Supabase', async () => {
  const mockSupabase = createClient as jest.Mock
  
  mockSupabase.mockReturnValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({
        data: [createMockDevice()],
        error: null
      })
    })
  })
  
  render(<DevicesList />)
  
  await waitFor(() => {
    expect(screen.getByText(/Device 1/)).toBeInTheDocument()
  })
})
```

### Custom Matchers

Use custom matchers from `setup.ts`:

```tsx
import { mockUUID } from '@/__tests__/mocks/factories'

it('generates valid UUIDs', () => {
  const id = mockUUID('device')
  
  expect(id).toBeValidUUID()
})

it('validates email format', () => {
  expect('user@example.com').toBeValidEmail()
})

it('checks date strings', () => {
  expect(new Date().toISOString()).toBeValidDate()
})
```

## Running Tests

### Local Development

```bash
# Watch mode (recommended for development)
npm run test:watch

# Run all tests once
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- __tests__/components/DeviceCard.test.tsx

# Run tests matching name
npm test -- --testNamePattern="Device"

# Run only failed tests
npm test -- --onlyFailures

# Update snapshots
npm test -- --updateSnapshot
```

### CI/CD

Tests run automatically on:
- Every push to `main` or `staging`
- Every pull request
- Manual workflow dispatch

See `.github/workflows/test.yml` for configuration.

## Coverage Requirements

### Thresholds

Minimum coverage requirements (enforced in CI):

| Metric | Minimum |
|--------|---------|
| Statements | 70% |
| Branches | 60% |
| Functions | 70% |
| Lines | 70% |

### Viewing Coverage

```bash
# Generate coverage report
npm run test:coverage

# Open HTML report
open coverage/lcov-report/index.html
```

### Coverage Reports in CI

Coverage reports are:
- Uploaded to Codecov
- Commented on pull requests
- Displayed in GitHub Actions summary

## Best Practices

### 1. Test Behavior, Not Implementation

❌ **Bad:** Testing implementation details
```tsx
it('calls setState with correct value', () => {
  const { result } = renderHook(() => useCounter())
  
  result.current.increment()
  
  // Don't test internal state management
  expect(result.current.setState).toHaveBeenCalledWith(1)
})
```

✅ **Good:** Testing user-facing behavior
```tsx
it('increments counter when button clicked', async () => {
  const user = userEvent.setup()
  render(<Counter />)
  
  await user.click(screen.getByRole('button', { name: /increment/i }))
  
  expect(screen.getByText('Count: 1')).toBeInTheDocument()
})
```

### 2. Use Descriptive Test Names

❌ **Bad:** Vague descriptions
```tsx
it('works', () => { /* ... */ })
it('test 1', () => { /* ... */ })
```

✅ **Good:** Clear, specific descriptions
```tsx
it('displays error message when API request fails', () => { /* ... */ })
it('disables submit button while form is submitting', () => { /* ... */ })
```

### 3. Arrange-Act-Assert Pattern

```tsx
it('filters devices by status', () => {
  // Arrange: Set up test data
  const devices = createMockDevices(5)
  devices[0].status = 'offline'
  
  // Act: Perform action
  render(<DeviceList devices={devices} filterStatus="offline" />)
  
  // Assert: Verify outcome
  expect(screen.getAllByRole('article')).toHaveLength(1)
})
```

### 4. Isolate Tests

Each test should be independent and not rely on others:

```tsx
describe('DeviceManager', () => {
  beforeEach(() => {
    resetMockCounter()
    jest.clearAllMocks()
  })
  
  // Each test stands alone
})
```

### 5. Mock External Dependencies

```tsx
// Mock third-party libraries
jest.mock('date-fns', () => ({
  format: jest.fn((date) => '2026-01-01'),
}))

// Mock API calls
jest.mock('@/services/api', () => ({
  fetchDevices: jest.fn().mockResolvedValue([])
}))
```

### 6. Test Edge Cases

```tsx
describe('DeviceCard', () => {
  it('handles missing battery level', () => {
    const device = createMockDevice({ battery_level: null })
    render(<DeviceCard device={device} />)
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })
  
  it('handles empty device name', () => {
    const device = createMockDevice({ name: '' })
    render(<DeviceCard device={device} />)
    expect(screen.getByText(/unnamed/i)).toBeInTheDocument()
  })
})
```

## Common Patterns

### Testing Forms

```tsx
it('validates required fields', async () => {
  const user = userEvent.setup()
  const onSubmit = jest.fn()
  
  render(<DeviceForm onSubmit={onSubmit} />)
  
  await user.click(screen.getByRole('button', { name: /submit/i }))
  
  expect(screen.getByText(/name is required/i)).toBeInTheDocument()
  expect(onSubmit).not.toHaveBeenCalled()
})
```

### Testing Modals

```tsx
it('opens and closes modal', async () => {
  const user = userEvent.setup()
  
  render(<DeviceManager />)
  
  await user.click(screen.getByRole('button', { name: /add device/i }))
  
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  
  await user.click(screen.getByRole('button', { name: /cancel/i }))
  
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
```

### Testing Lists

```tsx
it('renders empty state when no devices', () => {
  render(<DeviceList devices={[]} />)
  
  expect(screen.getByText(/no devices found/i)).toBeInTheDocument()
})

it('renders devices in correct order', () => {
  const devices = [
    createMockDevice({ name: 'Device A' }),
    createMockDevice({ name: 'Device B' }),
  ]
  
  render(<DeviceList devices={devices} sortBy="name" />)
  
  const items = screen.getAllByRole('article')
  expect(items[0]).toHaveTextContent('Device A')
  expect(items[1]).toHaveTextContent('Device B')
})
```

### Testing Loading States

```tsx
it('shows loading spinner while fetching', () => {
  render(<DevicesList />)
  
  expect(screen.getByRole('status')).toBeInTheDocument()
  expect(screen.getByLabelText(/loading/i)).toBeInTheDocument()
})
```

### Testing Error States

```tsx
it('displays error message when fetch fails', async () => {
  // Mock API failure
  jest.spyOn(console, 'error').mockImplementation()
  
  render(<DevicesList />)
  
  await waitFor(() => {
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument()
  })
})
```

## Troubleshooting

### Common Issues

#### 1. Tests timeout

```tsx
// Increase timeout for slow operations
it('loads large dataset', async () => {
  // ...
}, 30000) // 30 second timeout
```

#### 2. Async state updates

```tsx
// Wrap in act() or use waitFor
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument()
})
```

#### 3. Mock not working

```tsx
// Ensure mock is defined before component import
jest.mock('@/lib/supabase/client')

import { MyComponent } from '@/components/MyComponent'
```

#### 4. Context provider issues

```tsx
// Use customRender with provider overrides
render(<MyComponent />, {
  skipProviders: false, // Ensure providers are included
  userValue: { user: createMockUser() }
})
```

### Debugging Tests

```bash
# Run with Node debugger
node --inspect-brk node_modules/.bin/jest --runInBand

# Use console.debug in tests
console.debug(screen.debug())

# Use VS Code debugger
# Set breakpoint and press F5 (Jest debugging configured)
```

### Getting Help

- Check existing tests for patterns
- Review Jest documentation: https://jestjs.io/
- Review Testing Library docs: https://testing-library.com/
- Ask team for code review

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Next.js Testing](https://nextjs.org/docs/testing)

---

**Last Updated:** February 17, 2026  
**Maintainer:** NetNeural Development Team
