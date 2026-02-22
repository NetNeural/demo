/**
 * Tests for Issue #49: Organization Rename Functionality
 *
 * This test suite validates the organization update/rename functionality
 * to diagnose the "Failed to fetch" error reported in GitHub Issue #49.
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditOrganizationDialog } from '@/components/organizations/EditOrganizationDialog'

// Mock the toast hook
const mockToast = jest.fn()
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

// Mock Supabase client
const mockGetSession = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn(),
    },
  })),
}))

// Mock fetch globally
global.fetch = jest.fn()

describe('EditOrganizationDialog - Issue #49 Tests', () => {
  const mockOrganization = {
    id: 'org-123',
    name: 'Test Organization',
    slug: 'test-org',
    description: 'Original description',
    subscriptionTier: 'starter',
    is_active: true,
  }

  const mockSession = {
    access_token: 'mock-access-token-12345',
    user: { id: 'user-123' },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    // Re-configure createClient after clearAllMocks
    const { createClient } = jest.requireMock('@/lib/supabase/client') as {
      createClient: jest.Mock
    }
    createClient.mockReturnValue({ auth: { getSession: mockGetSession } })
    mockGetSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    })
    ;(global.fetch as jest.Mock).mockClear()

    // Set environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key'
  })

  describe('Environment Configuration', () => {
    test('should have required environment variables', () => {
      expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeDefined()
      expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeDefined()
    })
  })

  describe('Authentication', () => {
    test('should retrieve session token before making API call', async () => {
      const user = userEvent.setup()

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'org-123', name: 'Updated Organization' }),
      })

      render(
        <EditOrganizationDialog
          organization={mockOrganization}
          trigger={<button>Edit</button>}
        />
      )

      // Open dialog
      await user.click(screen.getByText('Edit'))

      // Wait for form to populate
      await waitFor(() => {
        expect(
          screen.getByDisplayValue('Test Organization')
        ).toBeInTheDocument()
      })

      // Change name
      const nameInput = screen.getByLabelText(/Organization Name/i)
      await user.clear(nameInput)
      await user.type(nameInput, 'Updated Organization')

      // Submit form
      const saveButton = screen.getByRole('button', { name: /Save Changes/i })
      await user.click(saveButton)

      // Verify session was retrieved
      await waitFor(() => {
        expect(mockGetSession).toHaveBeenCalled()
      })
    })

    test('should show error when not authenticated', async () => {
      const user = userEvent.setup()

      // Mock no session
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null })

      render(
        <EditOrganizationDialog
          organization={mockOrganization}
          trigger={<button>Edit</button>}
        />
      )

      await user.click(screen.getByText('Edit'))

      await waitFor(() => {
        expect(
          screen.getByDisplayValue('Test Organization')
        ).toBeInTheDocument()
      })

      const nameInput = screen.getByLabelText(/Organization Name/i)
      await user.clear(nameInput)
      await user.type(nameInput, 'Updated Name')

      const saveButton = screen.getByRole('button', { name: /Save Changes/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            description: 'Not authenticated',
            variant: 'destructive',
          })
        )
      })

      // Should NOT make fetch call
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  describe('API Request (Issue #49 - "Failed to fetch" diagnosis)', () => {
    test('should make PATCH request with correct URL format', async () => {
      const user = userEvent.setup()

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'org-123', name: 'Updated Organization' }),
      })

      render(
        <EditOrganizationDialog
          organization={mockOrganization}
          trigger={<button>Edit</button>}
        />
      )

      await user.click(screen.getByText('Edit'))
      await waitFor(() => {
        expect(
          screen.getByDisplayValue('Test Organization')
        ).toBeInTheDocument()
      })

      const nameInput = screen.getByLabelText(/Organization Name/i)
      await user.clear(nameInput)
      await user.type(nameInput, 'Updated Organization')

      const saveButton = screen.getByRole('button', { name: /Save Changes/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:54321/functions/v1/organizations/org-123',
          expect.objectContaining({
            method: 'PATCH',
          })
        )
      })
    })

    test('should include Authorization header with Bearer token', async () => {
      const user = userEvent.setup()

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'org-123', name: 'Updated Organization' }),
      })

      render(
        <EditOrganizationDialog
          organization={mockOrganization}
          trigger={<button>Edit</button>}
        />
      )

      await user.click(screen.getByText('Edit'))
      await waitFor(() => {
        expect(
          screen.getByDisplayValue('Test Organization')
        ).toBeInTheDocument()
      })

      const nameInput = screen.getByLabelText(/Organization Name/i)
      await user.clear(nameInput)
      await user.type(nameInput, 'Updated Organization')

      const saveButton = screen.getByRole('button', { name: /Save Changes/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer mock-access-token-12345',
              'Content-Type': 'application/json',
            }),
          })
        )
      })
    })

    test('should send correct request body', async () => {
      const user = userEvent.setup()

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'org-123', name: 'Updated Organization' }),
      })

      render(
        <EditOrganizationDialog
          organization={mockOrganization}
          trigger={<button>Edit</button>}
        />
      )

      await user.click(screen.getByText('Edit'))
      await waitFor(() => {
        expect(
          screen.getByDisplayValue('Test Organization')
        ).toBeInTheDocument()
      })

      const nameInput = screen.getByLabelText(/Organization Name/i)
      await user.clear(nameInput)
      await user.type(nameInput, 'Updated Organization')

      const descInput = screen.getByLabelText(/Description/i)
      await user.clear(descInput)
      await user.type(descInput, 'New description')

      const saveButton = screen.getByRole('button', { name: /Save Changes/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: JSON.stringify({
              name: 'Updated Organization',
              description: 'New description',
              subscriptionTier: 'starter',
              isActive: true,
            }),
          })
        )
      })
    })
  })

  describe('Network Error Handling (Issue #49)', () => {
    test('should handle network failure gracefully', async () => {
      const user = userEvent.setup()

      // Mock network error
      ;(global.fetch as jest.Mock).mockRejectedValue(
        new TypeError('Failed to fetch')
      )

      render(
        <EditOrganizationDialog
          organization={mockOrganization}
          trigger={<button>Edit</button>}
        />
      )

      await user.click(screen.getByText('Edit'))
      await waitFor(() => {
        expect(
          screen.getByDisplayValue('Test Organization')
        ).toBeInTheDocument()
      })

      const nameInput = screen.getByLabelText(/Organization Name/i)
      await user.clear(nameInput)
      await user.type(nameInput, 'Updated Organization')

      const saveButton = screen.getByRole('button', { name: /Save Changes/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            description: 'Failed to fetch',
            variant: 'destructive',
          })
        )
      })
    })

    test('should handle CORS error simulation', async () => {
      const user = userEvent.setup()

      // Simulate CORS-like error (network error without response)
      ;(global.fetch as jest.Mock).mockRejectedValue(
        new TypeError('NetworkError when attempting to fetch resource.')
      )

      render(
        <EditOrganizationDialog
          organization={mockOrganization}
          trigger={<button>Edit</button>}
        />
      )

      await user.click(screen.getByText('Edit'))
      await waitFor(() => {
        expect(
          screen.getByDisplayValue('Test Organization')
        ).toBeInTheDocument()
      })

      const nameInput = screen.getByLabelText(/Organization Name/i)
      await user.clear(nameInput)
      await user.type(nameInput, 'Updated Organization')

      const saveButton = screen.getByRole('button', { name: /Save Changes/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            variant: 'destructive',
          })
        )
      })
    })

    test('should handle 500 server error', async () => {
      const user = userEvent.setup()

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      })

      render(
        <EditOrganizationDialog
          organization={mockOrganization}
          trigger={<button>Edit</button>}
        />
      )

      await user.click(screen.getByText('Edit'))
      await waitFor(() => {
        expect(
          screen.getByDisplayValue('Test Organization')
        ).toBeInTheDocument()
      })

      const nameInput = screen.getByLabelText(/Organization Name/i)
      await user.clear(nameInput)
      await user.type(nameInput, 'Updated Organization')

      const saveButton = screen.getByRole('button', { name: /Save Changes/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            description: 'Internal server error',
            variant: 'destructive',
          })
        )
      })
    })
  })

  describe('Success Scenarios', () => {
    test('should successfully update organization name', async () => {
      const user = userEvent.setup()
      const mockOnSuccess = jest.fn()

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'org-123', name: 'Updated Organization' }),
      })

      render(
        <EditOrganizationDialog
          organization={mockOrganization}
          trigger={<button>Edit</button>}
          onSuccess={mockOnSuccess}
        />
      )

      await user.click(screen.getByText('Edit'))
      await waitFor(() => {
        expect(
          screen.getByDisplayValue('Test Organization')
        ).toBeInTheDocument()
      })

      const nameInput = screen.getByLabelText(/Organization Name/i)
      await user.clear(nameInput)
      await user.type(nameInput, 'Updated Organization')

      const saveButton = screen.getByRole('button', { name: /Save Changes/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Success!',
            description:
              'Organization "Updated Organization" has been updated.',
          })
        )
      })

      expect(mockOnSuccess).toHaveBeenCalled()
    })
  })

  describe('Validation', () => {
    test('should validate name is required', async () => {
      const user = userEvent.setup()

      render(
        <EditOrganizationDialog
          organization={mockOrganization}
          trigger={<button>Edit</button>}
        />
      )

      await user.click(screen.getByText('Edit'))
      await waitFor(() => {
        expect(
          screen.getByDisplayValue('Test Organization')
        ).toBeInTheDocument()
      })

      const nameInput = screen.getByLabelText(/Organization Name/i)
      await user.clear(nameInput)

      const saveButton = screen.getByRole('button', { name: /Save Changes/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(
          screen.getByText('Organization name is required')
        ).toBeInTheDocument()
      })

      // Should NOT make fetch call
      expect(global.fetch).not.toHaveBeenCalled()
    })

    test('should validate minimum name length', async () => {
      const user = userEvent.setup()

      render(
        <EditOrganizationDialog
          organization={mockOrganization}
          trigger={<button>Edit</button>}
        />
      )

      await user.click(screen.getByText('Edit'))
      await waitFor(() => {
        expect(
          screen.getByDisplayValue('Test Organization')
        ).toBeInTheDocument()
      })

      const nameInput = screen.getByLabelText(/Organization Name/i)
      await user.clear(nameInput)
      await user.type(nameInput, 'AB')

      const saveButton = screen.getByRole('button', { name: /Save Changes/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(
          screen.getByText('Name must be at least 3 characters')
        ).toBeInTheDocument()
      })

      expect(global.fetch).not.toHaveBeenCalled()
    })
  })
})
