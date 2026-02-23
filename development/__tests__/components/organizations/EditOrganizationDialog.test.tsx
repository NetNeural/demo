/**
 * Tests for Issue #49: Organization Rename Functionality
 *
 * This test suite validates the organization update/rename functionality
 * to diagnose the "Failed to fetch" error reported in GitHub Issue #49.
 *
 * The component uses edgeFunctions.organizations.update() internally,
 * so we mock the edge-functions client module directly.
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

// Mock edge-functions client — the component calls edgeFunctions.organizations.update()
const mockUpdate = jest.fn()
jest.mock('@/lib/edge-functions/client', () => ({
  edgeFunctions: {
    organizations: {
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
  EdgeFunctionClient: jest.fn(),
}))

// Mock Supabase client (needed by other transitive imports)
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: { getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }) },
  })),
}))

describe('EditOrganizationDialog - Issue #49 Tests', () => {
  const mockOrganization = {
    id: 'org-123',
    name: 'Test Organization',
    slug: 'test-org',
    description: 'Original description',
    subscriptionTier: 'starter',
    is_active: true,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    // Default: successful update
    mockUpdate.mockResolvedValue({
      success: true,
      data: { id: 'org-123', name: 'Updated Organization' },
    })

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key'
  })

  describe('Environment Configuration', () => {
    test('should have required environment variables', () => {
      expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeDefined()
      expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeDefined()
    })
  })

  describe('Authentication & API Request', () => {
    test('should call edgeFunctions.organizations.update on submit', async () => {
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
      await user.type(nameInput, 'Updated Organization')

      const saveButton = screen.getByRole('button', { name: /Save Changes/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(
          'org-123',
          expect.objectContaining({
            name: 'Updated Organization',
          })
        )
      })
    })

    test('should show error when API returns failure', async () => {
      const user = userEvent.setup()

      mockUpdate.mockResolvedValue({
        success: false,
        error: 'Not authenticated',
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
    })
  })

  describe('API Request (Issue #49 - "Failed to fetch" diagnosis)', () => {
    test('should send correct organization id and updated fields', async () => {
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
      await user.type(nameInput, 'Updated Organization')

      const saveButton = screen.getByRole('button', { name: /Save Changes/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(
          'org-123',
          expect.objectContaining({
            name: 'Updated Organization',
            subscriptionTier: 'starter',
            isActive: true,
          })
        )
      })
    })

    test('should send description when changed', async () => {
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
      await user.type(nameInput, 'Updated Organization')

      const descInput = screen.getByLabelText(/Description/i)
      await user.clear(descInput)
      await user.type(descInput, 'New description')

      const saveButton = screen.getByRole('button', { name: /Save Changes/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(
          'org-123',
          expect.objectContaining({
            name: 'Updated Organization',
            description: 'New description',
          })
        )
      })
    })
  })

  describe('Network Error Handling (Issue #49)', () => {
    test('should handle network failure gracefully', async () => {
      const user = userEvent.setup()

      mockUpdate.mockRejectedValue(new TypeError('Failed to fetch'))

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

      mockUpdate.mockRejectedValue(
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

    test('should handle API error response', async () => {
      const user = userEvent.setup()

      mockUpdate.mockResolvedValue({
        success: false,
        error: 'Internal server error',
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

      // Should NOT call the API
      expect(mockUpdate).not.toHaveBeenCalled()
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

      expect(mockUpdate).not.toHaveBeenCalled()
    })
  })
})
