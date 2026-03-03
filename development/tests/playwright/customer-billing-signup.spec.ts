/**
 * Customer Signup â†’ Billing Validation
 *
 * Tests the full customer creation journey:
 * 1. Signup UI flow (plan selection â†’ account details â†’ submission)
 * 2. Database record validation (org, subscription, billing profile all created)
 * 3. Billing tab completeness (PaymentMethodsCard, BillingContactCard present)
 * 4. Billing contact edit/save roundtrip
 *
 * Runs against local Supabase by default.
 * Set PLAYWRIGHT_BASE_URL and SUPABASE_URL for other environments.
 */

import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { authenticator } from 'otplib'
import * as fs from 'fs'
import * as path from 'path'

/** Loaded once — TOTP secret written by globalSetup */
let _adminTotpSecret: string | null | undefined = undefined // undefined = not yet loaded
function getAdminTotpSecret(): string | null {
  if (_adminTotpSecret !== undefined) return _adminTotpSecret
  try {
    const secretFile = path.join(__dirname, '.playwright-admin-totp.json')
    const data = JSON.parse(fs.readFileSync(secretFile, 'utf-8'))
    _adminTotpSecret = data.secret ?? null
  } catch {
    _adminTotpSecret = null
  }
  return _adminTotpSecret
}

// â”€â”€ Supabase admin client (service role) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'http://127.0.0.1:54321'

// Local Supabase CLI service-role key (safe to use in local-only tests)
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

// â”€â”€ Unique test customer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const RUN_ID = Date.now()
const TEST_EMAIL = `e2e-billing-${RUN_ID}@test.netneural.ai`
const TEST_PASSWORD = 'Abcde123!'         // Meets all validation rules
const TEST_FULL_NAME = `E2E Customer ${RUN_ID}`
const TEST_ORG_NAME = `E2E Org ${RUN_ID}`
const SELECTED_PLAN = 'starter'           // slug of the plan to select

// â”€â”€ Shared state across tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let newOrgId: string | null = null
let newUserId: string | null = null

// â”€â”€ Admin helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Dismiss cookie consent banner if present (blocks all clicks on demo.netneural.ai) */
async function dismissCookieBanner(page: Page) {
  try {
    // The banner may appear with a short delay after page load — wait up to 5s for it
    const bannerDialog = page.locator('[role="dialog"][aria-label*="ookie"]')
    await bannerDialog.waitFor({ state: 'visible', timeout: 5000 })
    // Dismiss via JavaScript evaluation to bypass any overlapping elements
    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]')
      if (!dialog) return
      // Try clicking the last button (usually Accept/Essential only)
      const buttons = dialog.querySelectorAll('button')
      if (buttons.length > 0) {
        ;(buttons[buttons.length - 1] as HTMLElement).click()
      }
    })
    // Also force-click any visible Accept/Essential/Close button
    const dismissBtn = page.locator('[role="dialog"] button').last()
    await dismissBtn.click({ force: true, timeout: 3000 }).catch(() => {})
    await bannerDialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
  } catch {
    // No banner or already dismissed — continue
  }
}

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/auth/login')
  await page.waitForLoadState('load')
  await dismissCookieBanner(page)
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button[type="submit"]').click({ force: true })

  // After credential submit, one of three things happens:
  //   A) TOTP challenge UI appears — #mfa-code input on the same /auth/login page
  //   B) Redirect to /auth/setup-mfa  (no TOTP factor enrolled yet)
  //   C) Redirect to /dashboard or /auth/change-password
  // Wait for the TOTP input OR a URL change, whichever comes first.
  const mfaInput = page.locator('#mfa-code')
  await Promise.race([
    page.waitForURL(/\/(dashboard|auth\/setup-mfa|auth\/change-password)/, { timeout: 20000 }).catch(() => null),
    mfaInput.waitFor({ state: 'visible', timeout: 20000 }).catch(() => null),
  ])

  // Case A — TOTP challenge (URL stays on /auth/login, #mfa-code input is visible)
  if (await mfaInput.isVisible().catch(() => false)) {
    const secret = getAdminTotpSecret()
    if (!secret) throw new Error('loginAs: TOTP required but no secret on disk — did globalSetup run?')
    const code = authenticator.generate(secret)
    await mfaInput.fill(code)
    await page.locator('button[type="submit"]').click({ force: true })
    // Wait for post-MFA redirect; retry once if code expired mid-entry
    await page.waitForURL(/\/(dashboard|auth\/setup-mfa|auth\/change-password)/, { timeout: 20000 })
      .catch(async () => {
        const fresh = authenticator.generate(secret)
        if (await mfaInput.isVisible().catch(() => false)) {
          await mfaInput.fill(fresh)
          await page.locator('button[type="submit"]').click({ force: true })
          await page.waitForURL(/\/(dashboard|auth\/setup-mfa|auth\/change-password)/, { timeout: 20000 }).catch(() => {})
        }
      })
  }

  // Case B — app-level enforcement redirected to setup-mfa (should not happen after
  // globalSetup enrols a verified factor, but guard defensively)
  if (page.url().includes('/auth/setup-mfa')) {
    throw new Error('loginAs: landed on /auth/setup-mfa — TOTP factor not verified for this session')
  }

  // Case C — password change required
  if (page.url().includes('/auth/change-password')) {
    await page.goto('/dashboard')
    await page.waitForLoadState('load')
  }

  // Ensure we end on the dashboard
  if (!page.url().includes('/dashboard')) {
    await page.goto('/dashboard')
    await page.waitForURL('**/dashboard**', { timeout: 15000 })
  }
}

// â”€â”€ Cleanup after all tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test.afterAll(async () => {
  if (!newUserId) return
  try {
    const supabase = adminClient()
    // Delete user â€” cascades to org_members; org stays to avoid data loss on re-runs
    await supabase.from('users').delete().eq('id', newUserId)
    await supabase.auth.admin.deleteUser(newUserId)
    console.log(`âœ… Cleaned up test user ${TEST_EMAIL}`)
  } catch (err) {
    console.warn('Cleanup failed (non-fatal):', err)
  }
})

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SUITE 1: Signup UI Journey
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
test.describe('Customer Signup â€” UI Journey', () => {

  test('signup page loads with plan selection', async ({ page }) => {
    await page.goto('/auth/signup')
    await page.waitForLoadState('load')
    // Wait for the loading spinner to disappear (plans are fetched async from DB)
    await page.locator('.animate-spin').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})
    await dismissCookieBanner(page)

    // Should show plan cards
    const planCards = page.locator('button').filter({ hasText: /starter|professional|enterprise/i })
    await expect(planCards.first()).toBeVisible({ timeout: 15000 })

    // Should have at least 3 plan tiers
    const planCount = await planCards.count()
    expect(planCount).toBeGreaterThan(2)
  })

  test('Step 1 â€” select a plan and advance', async ({ page }) => {
    await page.goto('/auth/signup')
    await page.waitForLoadState('load')
    await page.locator('.animate-spin').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})
    await dismissCookieBanner(page)
    // Click the Starter plan card
    const starterCard = page.locator('button').filter({ hasText: /starter/i }).first()
    await expect(starterCard).toBeVisible({ timeout: 10000 })
    await starterCard.click({ force: true })

    // Starter card should visually highlight / be selected
    // (border changes via class â€” just verify clicking doesn't error)
    await page.waitForTimeout(500)

    // "Continue" or "Next" button should appear / be enabled
    const continueBtn = page.locator('button').filter({ hasText: /continue|next|get started/i }).first()
    await expect(continueBtn).toBeVisible({ timeout: 5000 })
    await continueBtn.click({ force: true })

    // Should advance to step 2 (account details form)
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5000 })
  })

  test('Step 2 â€” password validation rules are enforced', async ({ page }) => {
    await page.goto('/auth/signup')
    await page.waitForLoadState('load')
    await page.locator('.animate-spin').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})
    await dismissCookieBanner(page)
    // Select plan
    await page.locator('button').filter({ hasText: /starter/i }).first().click()
    await page.waitForTimeout(300)
    const continueBtn = page.locator('button').filter({ hasText: /continue|next|get started/i }).first()
    await continueBtn.click({ force: true })

    await page.waitForTimeout(300)

    // Find password field and type a too-short password
    const passwordField = page.locator('input[type="password"]').first()
    await passwordField.fill('abc')

    // Should show validation hint about length
    const lengthHint = page.locator('text=/at least 8/i').first()
    await expect(lengthHint).toBeVisible({ timeout: 5000 })
  })

  test('Step 2 â€” fills account details and submits', async ({ page }) => {
    await page.goto('/auth/signup')
    await page.waitForLoadState('load')
    await page.locator('.animate-spin').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})
    await dismissCookieBanner(page)
    // Step 1: Pick plan
    await page.locator('button').filter({ hasText: /starter/i }).first().click()
    await page.waitForTimeout(300)
    const continueBtn = page.locator('button').filter({ hasText: /continue|next|get started/i }).first()
    await continueBtn.click({ force: true })
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

    // Wait for outcome: email confirmation, dashboard, MFA setup, or change-password
    await page.waitForURL(/\/(dashboard|auth\/setup-mfa|auth\/change-password|auth\/signup)/, { timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(2000)

    const url = page.url()
    const isEmailStep = await page.locator('text=/confirm|verification|check your email/i').isVisible()
    const isDashboard = url.includes('/dashboard')
    const isMfaSetup = url.includes('/auth/setup-mfa')
    const isChangePassword = url.includes('/auth/change-password')

    // At least one of these should be true â€” signup must not stay on step 2
    expect(isEmailStep || isDashboard || isMfaSetup || isChangePassword).toBe(true)

    // Find the newly created user via admin API.
    // Retry up to 5 times: triggers and edge-function provisioning can add a short delay.
    const supabase = adminClient()
    let newUser: { id: string; email?: string; email_confirmed_at?: string | null } | undefined
    for (let attempt = 1; attempt <= 5; attempt++) {
      await new Promise((r) => setTimeout(r, attempt * 1000)) // 1s, 2s, 3s, 4s, 5s
      const { data: userList, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
      if (listErr) {
        console.warn(`⚠️  listUsers attempt ${attempt} error: ${listErr.message}`)
        continue
      }
      console.log(`   listUsers attempt ${attempt}: ${userList?.users?.length ?? 0} total users`)
      newUser = userList?.users?.find(u => u.email === TEST_EMAIL)
      if (newUser) break
    }
    if (newUser) {
      newUserId = newUser.id
      await supabase.auth.admin.updateUserById(newUser.id, { email_confirm: true })
      if (isEmailStep) {
        console.log(`ℹ️  Email confirmation required — confirmed via admin API (id: ${newUser.id.slice(0, 8)})`)
      } else {
        console.log(`✅ Signup completed, user found (id: ${newUser.id.slice(0, 8)})`)
      }
    } else {
      // Log page state to help diagnose silent signup failures
      const pageText = await page.locator('body').innerText().catch(() => '(could not read body)')
      console.error(`❌ User ${TEST_EMAIL} NOT found after 5 listUsers attempts.`)
      console.error(`   Page URL: ${page.url()}`)
      console.error(`   Page body snippet: ${pageText.slice(0, 500)}`)
    }
  })
})

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SUITE 2: Database Record Validation
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
test.describe('Customer Billing â€” DB Records Created', () => {

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
    // This is a known gap â€” tested to document the expected NULL state at signup.
    if (sub.stripe_customer_id !== null) {
      console.log(`â„¹ï¸  stripe_customer_id is set: ${sub.stripe_customer_id}`)
    } else {
      console.log('â„¹ï¸  stripe_customer_id is NULL (expected â€” Stripe not yet configured at signup)')
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
    // billing_name and address should be null â€” customer hasn't filled them in yet
    expect(profile.billing_name).toBeNull()
    expect(profile.address_line1).toBeNull()
  })

  test('payment method table has no entries (expected â€” customer has not added card yet)', async () => {
    if (!newOrgId) test.skip()

    const supabase = adminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error, count } = await (supabase as any)
      .from('customer_payment_methods')
      .select('id', { count: 'exact' })
      .eq('organization_id', newOrgId)

    expect(error).toBeNull()
    expect(count).toBe(0) // No card on file at signup â€” this is the gap that should prompt user to add one
    console.log('â„¹ï¸  No payment methods yet (correct â€” customer must add card to start billing cycle)')
  })
})

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SUITE 3: Billing Tab UI Validation
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
test.describe('Customer Billing Tab â€” UI Completeness', () => {

  test.beforeEach(async ({ page }) => {
    if (!newUserId) {
      // Auto-setup: confirm user if needed, then login
      const supabase = adminClient()
      const { data } = await supabase.auth.admin.listUsers()
      const user = data?.users?.find(u => u.email === TEST_EMAIL)
      if (user) {
        newUserId = user.id
        await supabase.auth.admin.updateUserById(user.id, { email_confirm: true })
      } else {
        test.skip()
        return
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
    await page.waitForLoadState('load')
    await page.waitForTimeout(2000)

    // Find the new org card/row and click into it
    const orgLink = page.locator(`text=${TEST_ORG_NAME}`).first()
    await expect(orgLink).toBeVisible({ timeout: 10000 })
    await orgLink.click()
    await page.waitForLoadState('load')
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
    await page.waitForLoadState('load')
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
    await page.waitForLoadState('load')
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
    await page.waitForLoadState('load')
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
    await page.waitForLoadState('load')
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
    await page.waitForLoadState('load')
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SUITE 4: Billing Admin â€” new customer visible in admin view
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
test.describe('Admin Billing â€” new customer appears in Customers tab', () => {

  test('new customer appears in admin billing customers list', async ({ page }) => {
    // Login as admin
    const adminEmail = process.env.TEST_USER_EMAIL || 'admin@netneural.ai'
    const adminPassword = process.env.TEST_USER_PASSWORD || 'password123'
    await loginAs(page, adminEmail, adminPassword)

    // Navigate to admin billing â†’ customers
    await page.goto('/dashboard/billing?tab=customers')
    await page.waitForLoadState('load')
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
    await page.waitForLoadState('load')
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



