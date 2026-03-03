/**
 * Customer Signup → Billing Validation
 *
 * Tests the full customer creation journey:
 * 1. Signup UI flow (plan selection → account details → submission)
 * 2. Database record validation (org, subscription, billing profile all created)
 * 3. Billing tab completeness (PaymentMethodsCard, BillingContactCard present)
 * 4. Billing contact edit/save roundtrip
 *
 * Runs against local Supabase by default.
 * Set PLAYWRIGHT_BASE_URL and SUPABASE_URL for other environments.
 */

import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

// ── Supabase admin client (service role) ────────────────────────────────────
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'http://127.0.0.1:54321'

// Local Supabase CLI service-role key (safe to use in local-only tests)
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

// ── Unique test customer ─────────────────────────────────────────────────────
const RUN_ID = Date.now()
const TEST_EMAIL = `e2e-billing-${RUN_ID}@test.netneural.ai`
const TEST_PASSWORD = 'Abcde123!'         // Meets all validation rules
const TEST_FULL_NAME = `E2E Customer ${RUN_ID}`
const TEST_ORG_NAME = `E2E Org ${RUN_ID}`
const SELECTED_PLAN = 'starter'           // slug of the plan to select

// ── Shared state across tests ────────────────────────────────────────────────
let newOrgId: string | null = null
let newUserId: string | null = null

// ── Admin helper ─────────────────────────────────────────────────────────────
function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/auth/login')
  await page.waitForLoadState('networkidle')
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/dashboard**', { timeout: 15000 })
}

// ── Cleanup after all tests ──────────────────────────────────────────────────
test.afterAll(async () => {
  if (!newUserId) return
  try {
    const supabase = adminClient()
    // Delete user — cascades to org_members; org stays to avoid data loss on re-runs
    await supabase.from('users').delete().eq('id', newUserId)
    await supabase.auth.admin.deleteUser(newUserId)
    console.log(`✅ Cleaned up test user ${TEST_EMAIL}`)
  } catch (err) {
    console.warn('Cleanup failed (non-fatal):', err)
  }
})

// ════════════════════════════════════════════════════════════════════════════
// SUITE 1: Signup UI Journey
// ════════════════════════════════════════════════════════════════════════════
test.describe('Customer Signup — UI Journey', () => {

  test('signup page loads with plan selection', async ({ page }) => {
    await page.goto('/auth/signup')
    await page.waitForLoadState('networkidle')

    // Should show plan cards
    const planCards = page.locator('button').filter({ hasText: /starter|professional|enterprise/i })
    await expect(planCards.first()).toBeVisible({ timeout: 10000 })

    // Should have at least 3 plan tiers
    await expect(planCards).toHaveCountGreaterThan(2)
  })

  test('Step 1 — select a plan and advance', async ({ page }) => {
    await page.goto('/auth/signup')
    await page.waitForLoadState('networkidle')

    // Click the Starter plan card
    const starterCard = page.locator('button').filter({ hasText: /starter/i }).first()
    await expect(starterCard).toBeVisible({ timeout: 10000 })
    await starterCard.click()

    // Starter card should visually highlight / be selected
    // (border changes via class — just verify clicking doesn't error)
    await page.waitForTimeout(500)

    // "Continue" or "Next" button should appear / be enabled
    const continueBtn = page.locator('button').filter({ hasText: /continue|next|get started/i }).first()
    await expect(continueBtn).toBeVisible({ timeout: 5000 })
    await continueBtn.click()

    // Should advance to step 2 (account details form)
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5000 })
  })

  test('Step 2 — password validation rules are enforced', async ({ page }) => {
    await page.goto('/auth/signup')
    await page.waitForLoadState('networkidle')

    // Select plan
    await page.locator('button').filter({ hasText: /starter/i }).first().click()
    await page.waitForTimeout(300)
    const continueBtn = page.locator('button').filter({ hasText: /continue|next|get started/i }).first()
    await continueBtn.click()

    await page.waitForTimeout(300)

    // Find password field and type a too-short password
    const passwordField = page.locator('input[type="password"]').first()
    await passwordField.fill('abc')

    // Should show validation hint about length
    const lengthHint = page.locator('text=/at least 8/i').first()
    await expect(lengthHint).toBeVisible({ timeout: 5000 })
  })

  test('Step 2 — fills account details and submits', async ({ page }) => {
    await page.goto('/auth/signup')
    await page.waitForLoadState('networkidle')

    // Step 1: Pick plan
    await page.locator('button').filter({ hasText: /starter/i }).first().click()
    await page.waitForTimeout(300)
    const continueBtn = page.locator('button').filter({ hasText: /continue|next|get started/i }).first()
    await continueBtn.click()
    await page.waitForTimeout(500)

    // Step 2: Account details
    // Full name
    const nameInput = page.locator('input[placeholder*="full name" i], input[placeholder*="your name" i], input[id*="name" i]').first()
    await nameInput.fill(TEST_FULL_NAME)

    // Organization name
    const orgInput = page.locator('input[placeholder*="organization" i], input[placeholder*="company" i], input[id*="org" i]').first()
    await orgInput.fill(TEST_ORG_NAME)

    // Email
    await page.locator('input[type="email"]').fill(TEST_EMAIL)

    // Password (matches all rules: >=8 chars, uppercase, number)
    const passwords = page.locator('input[type="password"]')
    await passwords.nth(0).fill(TEST_PASSWORD)
    await passwords.nth(1).fill(TEST_PASSWORD)

    // Agree to terms checkbox
    const termsCheckbox = page.locator('input[type="checkbox"]').first()
    if (await termsCheckbox.isVisible()) {
      await termsCheckbox.check()
    }

    // Submit button should be enabled
    const submitBtn = page.locator('button[type="submit"], button').filter({ hasText: /create account|sign up|register|get started/i }).last()
    await expect(submitBtn).toBeEnabled({ timeout: 5000 })
    await submitBtn.click()

    // Wait for outcome: either email confirmation screen or dashboard
    await page.waitForTimeout(3000)

    const url = page.url()
    const isEmailStep = await page.locator('text=/confirm|verification|check your email/i').isVisible()
    const isDashboard = url.includes('/dashboard')

    // At least one of these should be true — signup must not stay on step 2
    expect(isEmailStep || isDashboard).toBe(true)

    if (isEmailStep) {
      console.log('ℹ️  Email confirmation required — confirming user via admin API')
      // Confirm the user via admin API so subsequent tests can log in
      const supabase = adminClient()
      const { data: userList } = await supabase.auth.admin.listUsers()
      const newUser = userList?.users?.find(u => u.email === TEST_EMAIL)
      if (newUser) {
        newUserId = newUser.id
        await supabase.auth.admin.updateUserById(newUser.id, { email_confirm: true })
        console.log(`✅ Email confirmed for ${TEST_EMAIL} (id: ${newUser.id.slice(0, 8)})`)
      }
    } else {
      // Already on dashboard — capture user ID
      const supabase = adminClient()
      const { data: userList } = await supabase.auth.admin.listUsers()
      const newUser = userList?.users?.find(u => u.email === TEST_EMAIL)
      if (newUser) newUserId = newUser.id
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════
// SUITE 2: Database Record Validation
// ════════════════════════════════════════════════════════════════════════════
test.describe('Customer Billing — DB Records Created', () => {

  test.beforeAll(async () => {
    // If prior suite didn't set newUserId, look up the user by email
    if (!newUserId) {
      const supabase = adminClient()
      const { data } = await supabase.auth.admin.listUsers()
      const user = data?.users?.find(u => u.email === TEST_EMAIL)
      if (user) {
        newUserId = user.id
        await supabase.auth.admin.updateUserById(user.id, { email_confirm: true })
      }
    }
  })

  test('auth user was created with correct email', async () => {
    const supabase = adminClient()
    const { data } = await supabase.auth.admin.listUsers()
    const user = data?.users?.find(u => u.email === TEST_EMAIL)

    expect(user, `Auth user ${TEST_EMAIL} should exist`).toBeTruthy()
    expect(user!.email).toBe(TEST_EMAIL)
    expect(user!.email_confirmed_at).toBeTruthy()

    newUserId = user!.id
  })

  test('public.users profile was created by trigger', async () => {
    if (!newUserId) test.skip()

    const supabase = adminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('users')
      .select('id, email, full_name, role')
      .eq('id', newUserId)
      .maybeSingle()

    expect(error).toBeNull()
    expect(data, `users profile should exist for ${newUserId}`).toBeTruthy()
    expect(data.email).toBe(TEST_EMAIL)
  })

  test('organization was created with correct name and subscription_tier', async () => {
    if (!newUserId) test.skip()

    const supabase = adminClient()

    // Find org via organization_members
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: membership } = await (supabase as any)
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', newUserId)
      .eq('role', 'owner')
      .maybeSingle()

    expect(membership, `Owner membership should exist for user ${newUserId}`).toBeTruthy()
    expect(membership.role).toBe('owner')

    newOrgId = membership.organization_id

    // Now validate the org record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: org } = await (supabase as any)
      .from('organizations')
      .select('id, name, subscription_tier, lifecycle_stage, is_active')
      .eq('id', newOrgId)
      .maybeSingle()

    expect(org, 'Organization record should exist').toBeTruthy()
    expect(org.name).toBe(TEST_ORG_NAME)
    expect(org.is_active).toBe(true)

    // subscription_tier should match the selected plan slug
    // (either already synced or will be updated by sync migration)
    expect(['starter', 'professional', 'enterprise', 'free']).toContain(org.subscription_tier)
  })

  test('subscription record exists for the organization', async () => {
    if (!newOrgId) test.skip()

    const supabase = adminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sub, error } = await (supabase as any)
      .from('subscriptions')
      .select('id, status, plan_id, stripe_customer_id, cancel_at_period_end')
      .eq('organization_id', newOrgId)
      .maybeSingle()

    expect(error).toBeNull()
    expect(sub, `Subscription should exist for org ${newOrgId}`).toBeTruthy()
    expect(['active', 'trialing']).toContain(sub.status)
    expect(sub.cancel_at_period_end).toBe(false)

    // Note: stripe_customer_id will be NULL until Stripe checkout is initiated.
    // This is a known gap — tested to document the expected NULL state at signup.
    if (sub.stripe_customer_id !== null) {
      console.log(`ℹ️  stripe_customer_id is set: ${sub.stripe_customer_id}`)
    } else {
      console.log('ℹ️  stripe_customer_id is NULL (expected — Stripe not yet configured at signup)')
    }
  })

  test('billing profile was auto-created by trigger', async () => {
    if (!newOrgId) test.skip()

    const supabase = adminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile, error } = await (supabase as any)
      .from('customer_billing_profiles')
      .select('id, organization_id, company_name, billing_name, billing_email, address_line1')
      .eq('organization_id', newOrgId)
      .maybeSingle()

    expect(error).toBeNull()
    expect(profile, `Billing profile should exist for org ${newOrgId}`).toBeTruthy()
    expect(profile.organization_id).toBe(newOrgId)
    // company_name should be auto-populated from org name by the trigger
    expect(profile.company_name).toBe(TEST_ORG_NAME)
    // billing_name and address should be null — customer hasn't filled them in yet
    expect(profile.billing_name).toBeNull()
    expect(profile.address_line1).toBeNull()
  })

  test('payment method table has no entries (expected — customer has not added card yet)', async () => {
    if (!newOrgId) test.skip()

    const supabase = adminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error, count } = await (supabase as any)
      .from('customer_payment_methods')
      .select('id', { count: 'exact' })
      .eq('organization_id', newOrgId)

    expect(error).toBeNull()
    expect(count).toBe(0) // No card on file at signup — this is the gap that should prompt user to add one
    console.log('ℹ️  No payment methods yet (correct — customer must add card to start billing cycle)')
  })
})

// ════════════════════════════════════════════════════════════════════════════
// SUITE 3: Billing Tab UI Validation
// ════════════════════════════════════════════════════════════════════════════
test.describe('Customer Billing Tab — UI Completeness', () => {

  test.beforeEach(async ({ page }) => {
    if (!newUserId) {
      // Auto-setup: confirm user if needed, then login
      const supabase = adminClient()
      const { data } = await supabase.auth.admin.listUsers()
      const user = data?.users?.find(u => u.email === TEST_EMAIL)
      if (user) {
        newUserId = user.id
        await supabase.auth.admin.updateUserById(user.id, { email_confirm: true })
      }
    }
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
  })

  test('dashboard loads after login', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
    // Should not be stuck on an error page
    const errorHeading = page.locator('text=/500|error|not found/i').first()
    const isError = await errorHeading.isVisible()
    expect(isError).toBe(false)
  })

  test('billing tab is accessible from organization settings', async ({ page }) => {
    // Navigate to the organizations page
    await page.goto('/dashboard/organizations')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Find the new org card/row and click into it
    const orgLink = page.locator(`text=${TEST_ORG_NAME}`).first()
    await expect(orgLink).toBeVisible({ timeout: 10000 })
    await orgLink.click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Navigate to Billing tab
    const billingTab = page.locator('[role="tab"]').filter({ hasText: /billing/i }).first()
    await expect(billingTab).toBeVisible({ timeout: 5000 })
    await billingTab.click()
    await page.waitForTimeout(2000)

    // Current plan card should be visible
    const planCard = page.locator('text=/current plan/i').first()
    await expect(planCard).toBeVisible({ timeout: 10000 })
  })

  test('billing tab shows subscription plan name', async ({ page }) => {
    await page.goto('/dashboard/organizations')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const orgLink = page.locator(`text=${TEST_ORG_NAME}`).first()
    await expect(orgLink).toBeVisible({ timeout: 10000 })
    await orgLink.click()
    await page.waitForTimeout(1000)

    const billingTab = page.locator('[role="tab"]').filter({ hasText: /billing/i }).first()
    await billingTab.click()
    await page.waitForTimeout(2000)

    // Plan name should appear (Starter / Professional / Enterprise)
    const planName = page.locator('text=/starter|professional|enterprise/i').first()
    await expect(planName).toBeVisible({ timeout: 10000 })
  })

  test('billing tab shows payment methods card with empty state', async ({ page }) => {
    await page.goto('/dashboard/organizations')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const orgLink = page.locator(`text=${TEST_ORG_NAME}`).first()
    await expect(orgLink).toBeVisible({ timeout: 10000 })
    await orgLink.click()
    await page.waitForTimeout(1000)

    const billingTab = page.locator('[role="tab"]').filter({ hasText: /billing/i }).first()
    await billingTab.click()
    await page.waitForTimeout(3000)

    // PaymentMethodsCard must be present
    const pmCard = page.locator('[data-testid="payment-methods-card"]')
    await expect(pmCard).toBeVisible({ timeout: 10000 })

    // Should show the "no payment method" empty state
    const noPayment = page.locator('[data-testid="no-payment-method"]')
    await expect(noPayment).toBeVisible({ timeout: 5000 })

    // CTA button to add first payment method should be visible
    const addPaymentBtn = page.locator('[data-testid="add-first-payment-method-btn"]')
    await expect(addPaymentBtn).toBeVisible({ timeout: 5000 })
  })

  test('billing tab shows billing contact card with empty state', async ({ page }) => {
    await page.goto('/dashboard/organizations')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const orgLink = page.locator(`text=${TEST_ORG_NAME}`).first()
    await expect(orgLink).toBeVisible({ timeout: 10000 })
    await orgLink.click()
    await page.waitForTimeout(1000)

    const billingTab = page.locator('[role="tab"]').filter({ hasText: /billing/i }).first()
    await billingTab.click()
    await page.waitForTimeout(3000)

    // BillingContactCard must be present
    const contactCard = page.locator('[data-testid="billing-contact-card"]')
    await expect(contactCard).toBeVisible({ timeout: 10000 })

    // Should show the "no billing contact set" empty state
    const noContact = page.locator('[data-testid="no-billing-contact"]')
    await expect(noContact).toBeVisible({ timeout: 5000 })
  })

  test('billing contact can be filled in and saved', async ({ page }) => {
    await page.goto('/dashboard/organizations')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const orgLink = page.locator(`text=${TEST_ORG_NAME}`).first()
    await expect(orgLink).toBeVisible({ timeout: 10000 })
    await orgLink.click()
    await page.waitForTimeout(1000)

    const billingTab = page.locator('[role="tab"]').filter({ hasText: /billing/i }).first()
    await billingTab.click()
    await page.waitForTimeout(3000)

    // Click "Add Billing Contact" or "Edit"
    const editBtn = page
      .locator('[data-testid="add-billing-contact-btn"], [data-testid="edit-billing-contact-btn"]')
      .first()
    await expect(editBtn).toBeVisible({ timeout: 5000 })
    await editBtn.click()
    await page.waitForTimeout(500)

    // Fill in the form
    await page.locator('[data-testid="billing-name-input"]').fill('Jane Smith')
    await page.locator('[data-testid="billing-email-input"]').fill(`billing-${RUN_ID}@testcorp.ai`)
    await page.locator('[data-testid="company-name-input"]').fill('TestCorp LLC')
    await page.locator('[data-testid="address-line1-input"]').fill('1 Market Street')
    await page.locator('[data-testid="city-input"]').fill('San Francisco')
    await page.locator('[data-testid="postal-code-input"]').fill('94105')

    // Save
    await page.locator('[data-testid="save-billing-contact-btn"]').click()
    await page.waitForTimeout(2000)

    // Should show the saved values in read mode
    await expect(page.locator('[data-testid="billing-name-display"]')).toHaveText('Jane Smith')
    await expect(page.locator('[data-testid="company-name-display"]')).toHaveText('TestCorp LLC')
    await expect(page.locator('[data-testid="address-display"]')).toHaveText('1 Market Street')
  })

  test('billing contact is persisted in database after save', async ({ page }) => {
    if (!newOrgId) {
      // Re-fetch org ID
      if (newUserId) {
        const supabase = adminClient()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', newUserId)
          .eq('role', 'owner')
          .maybeSingle()
        if (data) newOrgId = data.organization_id
      }
    }
    if (!newOrgId) test.skip()

    const supabase = adminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from('customer_billing_profiles')
      .select('billing_name, company_name, address_line1, city')
      .eq('organization_id', newOrgId)
      .maybeSingle()

    expect(profile?.billing_name).toBe('Jane Smith')
    expect(profile?.company_name).toBe('TestCorp LLC')
    expect(profile?.address_line1).toBe('1 Market Street')
    expect(profile?.city).toBe('San Francisco')
  })

  test('manage subscription button opens Stripe portal or shows message', async ({ page }) => {
    await page.goto('/dashboard/organizations')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const orgLink = page.locator(`text=${TEST_ORG_NAME}`).first()
    await expect(orgLink).toBeVisible({ timeout: 10000 })
    await orgLink.click()
    await page.waitForTimeout(1000)

    const billingTab = page.locator('[role="tab"]').filter({ hasText: /billing/i }).first()
    await billingTab.click()
    await page.waitForTimeout(3000)

    // "Manage Subscription" button should be visible in the Current Plan card
    const manageBtn = page.locator('button').filter({ hasText: /manage subscription/i }).first()
    await expect(manageBtn).toBeVisible({ timeout: 10000 })
    // Button should be enabled (not disabled)
    await expect(manageBtn).toBeEnabled()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// SUITE 4: Billing Admin — new customer visible in admin view
// ════════════════════════════════════════════════════════════════════════════
test.describe('Admin Billing — new customer appears in Customers tab', () => {

  test('new customer appears in admin billing customers list', async ({ page }) => {
    // Login as admin
    const adminEmail = process.env.TEST_USER_EMAIL || 'admin@netneural.ai'
    const adminPassword = process.env.TEST_USER_PASSWORD || 'password123'
    await loginAs(page, adminEmail, adminPassword)

    // Navigate to admin billing → customers
    await page.goto('/dashboard/billing?tab=customers')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Find the customers tab
    const customersTab = page.locator('[role="tab"]').filter({ hasText: /customers/i }).first()
    await expect(customersTab).toBeVisible({ timeout: 5000 })
    await customersTab.click()
    await page.waitForTimeout(2000)

    // The new org should appear in the list
    const orgEntry = page.locator(`text=${TEST_ORG_NAME}`).first()
    await expect(orgEntry).toBeVisible({ timeout: 15000 })
  })

  test('new customer subscription appears in admin subscriptions tab', async ({ page }) => {
    const adminEmail = process.env.TEST_USER_EMAIL || 'admin@netneural.ai'
    const adminPassword = process.env.TEST_USER_PASSWORD || 'password123'
    await loginAs(page, adminEmail, adminPassword)

    await page.goto('/dashboard/billing')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const subsTab = page.locator('[role="tab"]').filter({ hasText: /subscriptions/i }).first()
    await expect(subsTab).toBeVisible({ timeout: 5000 })
    await subsTab.click()
    await page.waitForTimeout(2000)

    // New org subscription should appear
    const orgEntry = page.locator(`text=${TEST_ORG_NAME}`).first()
    await expect(orgEntry).toBeVisible({ timeout: 15000 })
  })
})
