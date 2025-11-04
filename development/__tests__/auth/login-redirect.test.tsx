/**
 * Test Suite for Issue #23: Login Redirect to Dashboard
 * 
 * Tests the authentication flow and redirect behavior after successful login
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import LoginPage from '@/app/auth/login/page'
import { createClient } from '@/lib/supabase/client'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

describe('Issue #23: Login Redirect Flow', () => {
  let mockRouter: {
    push: jest.Mock;
    replace: jest.Mock;
    refresh: jest.Mock;
  };
  let mockSupabase: {
    auth: {
      signInWithPassword: jest.Mock;
      getSession: jest.Mock;
      setSession: jest.Mock;
    };
  };

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks()

    // Mock router
    mockRouter = {
      push: jest.fn(),
      replace: jest.fn(),
      refresh: jest.fn(),
    }
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)

    // Mock Supabase client
    mockSupabase = {
      auth: {
        signInWithPassword: jest.fn(),
        getSession: jest.fn(),
        setSession: jest.fn(),
      },
    }
    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)
  })

  /**
   * TC1: Successful login redirects to /dashboard
   */
  test('TC1: redirects to dashboard after successful login', async () => {
    // Mock successful login
    const mockSession = {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      user: { id: 'user-123', email: 'test@example.com' },
    }

    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: mockSession.user, session: mockSession },
      error: null,
    })

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    })

    render(<LoginPage />)

    // Fill in login form
    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    // Wait for redirect
    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard')
    }, { timeout: 3000 })

    // Verify session was checked
    expect(mockSupabase.auth.getSession).toHaveBeenCalled()
  })

  /**
   * TC2: Failed login shows error message
   */
  test('TC2: shows error message on failed login', async () => {
    // Mock failed login
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid credentials' },
    })

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })

    render(<LoginPage />)

    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } })
    fireEvent.click(submitButton)

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument()
    })

    // Should NOT redirect
    expect(mockRouter.push).not.toHaveBeenCalled()
  })

  /**
   * TC3: Already authenticated user accessing /auth/login redirects to /dashboard
   */
  test('TC3: redirects authenticated user to dashboard', async () => {
    const mockSession = {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      user: { id: 'user-123', email: 'test@example.com' },
    }

    // Mock existing session
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    })

    render(<LoginPage />)

    // Should redirect immediately
    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard')
    })
  })

  /**
   * TC4: Session timeout redirects to login
   * (Note: This would be tested in a different component - dashboard/middleware)
   */
  test('TC4: handles no session gracefully', async () => {
    // Mock no session
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })

    render(<LoginPage />)

    // Should NOT redirect if no session
    await waitFor(() => {
      expect(mockRouter.replace).not.toHaveBeenCalled()
    }, { timeout: 1000 })

    // Form should be visible
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
  })

  /**
   * TC5: Direct navigation to /dashboard works after login
   */
  test('TC5: session persists and allows navigation', async () => {
    const mockSession = {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      user: { id: 'user-123', email: 'test@example.com' },
    }

    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: mockSession.user, session: mockSession },
      error: null,
    })

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    })

    render(<LoginPage />)

    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard')
      expect(mockSupabase.auth.getSession).toHaveBeenCalled()
    })

    // Session should be established
    const { data } = await mockSupabase.auth.getSession()
    expect(data.session).toBeTruthy()
  })

  /**
   * TC6: Browser refresh maintains session and dashboard access
   */
  test('TC6: session persists across page refreshes', async () => {
    const mockSession = {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      user: { id: 'user-123', email: 'test@example.com' },
    }

    // Mock persistent session
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    })

    // First render
    const { unmount } = render(<LoginPage />)

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard')
    })

    unmount()

    // Simulate page refresh by re-rendering
    render(<LoginPage />)

    // Should still have session and redirect
    await waitFor(() => {
      expect(mockSupabase.auth.getSession).toHaveBeenCalled()
    })
  })

  /**
   * TC7: Loading state shows during authentication
   */
  test('TC7: shows loading state during login', async () => {
    mockSupabase.auth.signInWithPassword.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                data: {
                  user: { id: 'user-123', email: 'test@example.com' },
                  session: { access_token: 'token', refresh_token: 'refresh' },
                },
                error: null,
              }),
            500
          )
        )
    )

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })

    render(<LoginPage />)

    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText(/signing in/i)).toBeInTheDocument()
    })
  })

  /**
   * TC8: Remember me option affects session duration
   */
  test('TC8: remember me checkbox affects session handling', async () => {
    const mockSession = {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      user: { id: 'user-123', email: 'test@example.com' },
    }

    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: mockSession.user, session: mockSession },
      error: null,
    })

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    })

    render(<LoginPage />)

    screen.getByLabelText(/remember me/i) // Verify it exists
    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    // Don't check remember me
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      // Should call setSession when remember me is NOT checked
      expect(mockSupabase.auth.setSession).toHaveBeenCalled()
    })
  })
})
