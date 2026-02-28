/**
 * Test Utilities for React Components
 *
 * Custom render function that wraps components with necessary providers
 * (OrganizationProvider, UserProvider, etc.) for testing.
 */

import React, { ReactElement } from 'react'
import { render, RenderOptions, RenderResult } from '@testing-library/react'
import { OrganizationProvider } from '@/contexts/OrganizationContext'
import { UserProvider } from '@/contexts/UserContext'

/**
 * Custom render options with provider configuration
 */
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /**
   * Initial organization context value
   */
  organizationValue?: {
    currentOrganization: any
    organizations: any[]
    setCurrentOrganization: jest.Mock
    loading: boolean
    error: string | null
  }

  /**
   * Initial user context value
   */
  userValue?: {
    user: any
    loading: boolean
    error: string | null
    isSuperAdmin: boolean
    isOrgOwner: boolean
    isOrgAdmin: boolean
    role: string | null
  }

  /**
   * Whether to skip provider wrappers (for testing providers themselves)
   */
  skipProviders?: boolean
}

/**
 * Default mock organization
 */
export const mockOrganization = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Test Organization',
  domain: 'test.example.com',
  settings: {},
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

/**
 * Default mock user
 */
export const mockUser = {
  id: '00000000-0000-0000-0000-000000000002',
  email: 'test@example.com',
  user_metadata: {
    name: 'Test User',
  },
  app_metadata: {},
  created_at: '2026-01-01T00:00:00Z',
}

/**
 * Create a wrapper component with all necessary providers
 */
function createWrapper(options: CustomRenderOptions = {}) {
  const { organizationValue, userValue, skipProviders = false } = options

  if (skipProviders) {
    return ({ children }: { children: React.ReactNode }) => <>{children}</>
  }

  // Default organization context value
  const defaultOrgValue = {
    currentOrganization: mockOrganization,
    organizations: [mockOrganization],
    setCurrentOrganization: jest.fn(),
    loading: false,
    error: null,
    ...organizationValue,
  }

  // Default user context value
  const defaultUserValue = {
    user: mockUser,
    loading: false,
    error: null,
    isSuperAdmin: false,
    isOrgOwner: true,
    isOrgAdmin: true,
    role: 'org_owner',
    ...userValue,
  }

  return ({ children }: { children: React.ReactNode }) => (
    <UserProvider value={defaultUserValue}>
      <OrganizationProvider value={defaultOrgValue}>
        {children}
      </OrganizationProvider>
    </UserProvider>
  )
}

/**
 * Custom render function that includes providers
 *
 * @example
 * ```tsx
 * import { customRender, screen } from '@/__tests__/utils/test-utils'
 *
 * customRender(<MyComponent />)
 * expect(screen.getByText('Hello')).toBeInTheDocument()
 * ```
 *
 * @example With custom context values
 * ```tsx
 * customRender(<MyComponent />, {
 *   userValue: { isSuperAdmin: true }
 * })
 * ```
 */
export function customRender(
  ui: ReactElement,
  options: CustomRenderOptions = {}
): RenderResult {
  const { skipProviders, ...renderOptions } = options
  const Wrapper = createWrapper(options)

  return render(ui, {
    wrapper: Wrapper,
    ...renderOptions,
  })
}

/**
 * Re-export everything from React Testing Library
 */
export * from '@testing-library/react'

/**
 * Export user-event for interaction testing
 */
export { default as userEvent } from '@testing-library/user-event'

/**
 * Override render with customRender
 */
export { customRender as render }
