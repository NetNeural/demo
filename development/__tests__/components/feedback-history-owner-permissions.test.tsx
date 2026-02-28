import { render, screen, waitFor } from '@testing-library/react'
import { FeedbackHistory } from '../../src/components/feedback/FeedbackHistory'
import { createClient } from '../../src/lib/supabase/client'

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/contexts/OrganizationContext', () => ({
  useOrganization: () => ({
    currentOrganization: { id: 'org-1', name: 'Org 1' },
  }),
}))

jest.mock('@/contexts/UserContext', () => ({
  useUser: () => ({
    user: { id: 'user-owner', email: 'owner@example.com' },
  }),
}))

jest.mock('@/hooks/useDateFormatter', () => ({
  useDateFormatter: () => ({
    fmt: {
      shortDateTime: () => '2026-02-23 00:00',
    },
  }),
}))

jest.mock('@/components/feedback/FeedbackDetailDialog', () => ({
  FeedbackDetailDialog: () => null,
}))

describe('FeedbackHistory owner permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    const feedbackRows = [
      {
        id: 'fb-owner',
        user_id: 'user-owner',
        type: 'bug_report',
        title: 'Owner ticket',
        description: 'Owner can edit/delete this',
        severity: 'medium',
        status: 'submitted',
        github_issue_number: null,
        github_issue_url: null,
        github_resolution: null,
        created_at: '2026-02-23T00:00:00Z',
      },
      {
        id: 'fb-other',
        user_id: 'user-other',
        type: 'feature_request',
        title: 'Other ticket',
        description: 'Owner should not edit/delete this',
        severity: null,
        status: 'submitted',
        github_issue_number: null,
        github_issue_url: null,
        github_resolution: null,
        created_at: '2026-02-23T00:00:00Z',
      },
    ]

    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: feedbackRows, error: null }),
      delete: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    }

    ;(createClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue(queryBuilder),
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      },
    })
  })

  test('shows edit/delete only for tickets created by current user', async () => {
    render(<FeedbackHistory refreshKey={1} />)

    await screen.findByText('Owner ticket')
    await screen.findByText('Other ticket')

    expect(
      screen.getByLabelText('Edit feedback Owner ticket')
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('Delete feedback Owner ticket')
    ).toBeInTheDocument()

    expect(
      screen.queryByLabelText('Edit feedback Other ticket')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText('Delete feedback Other ticket')
    ).not.toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Open Tickets')).toBeInTheDocument()
    })
  })
})
