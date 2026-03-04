/**
 * Global Setup for Playwright Tests
 *
 * Creates a test user in Supabase Auth (via Admin API) before tests run.
 * The trigger `on_auth_user_created` auto-creates the public.users profile.
 *
 * Environment variables (all optional — defaults to local Supabase CLI values):
 *   SUPABASE_URL              - Supabase API URL (default: http://127.0.0.1:54321)
 *   SUPABASE_SERVICE_ROLE_KEY - Service-role key for admin operations
 *   TEST_USER_EMAIL           - Test user email (default: admin@netneural.ai)
 *   TEST_USER_PASSWORD        - Test user password (default: password123)
 */
import { createClient } from '@supabase/supabase-js'
import { authenticator } from 'otplib'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load .env.test.local (if present) so callers don't need to export vars manually
const envTestLocal = path.resolve(__dirname, '..', '.env.test.local')
if (fs.existsSync(envTestLocal)) {
  dotenv.config({ path: envTestLocal })
  console.log('   📄 Loaded env from .env.test.local')
}

/** File where the admin TOTP secret is persisted across test runs */
const TOTP_SECRET_FILE = path.join(
  __dirname,
  'playwright',
  '.playwright-admin-totp.json'
)

// Well-known local Supabase CLI keys (safe to commit — only work on localhost)
const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
const LOCAL_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

// Default test user credentials (must match what test specs use)
const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'admin@netneural.ai'
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'password123'

export default async function globalSetup() {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    LOCAL_SUPABASE_URL
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || LOCAL_SERVICE_ROLE_KEY

  console.log(`\n🔧 Playwright Global Setup`)
  console.log(`   Supabase URL: ${supabaseUrl}`)
  console.log(`   Test user:    ${TEST_EMAIL}`)

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Check if test user already exists
  const { data: existingUsers, error: listError } =
    await supabase.auth.admin.listUsers()

  if (listError) {
    console.error(
      '   ❌ Failed to list users — is Supabase running?',
      listError.message
    )
    console.error('   💡 Start Supabase: cd development && npx supabase start')
    throw new Error(`Global setup failed: ${listError.message}`)
  }

  const existingUser = existingUsers?.users?.find((u) => u.email === TEST_EMAIL)

  if (existingUser) {
    console.log(
      `   ✅ Test user already exists (id: ${existingUser.id.slice(0, 8)}...)`
    )
  } else {
    // Create the test user via admin API
    const { data: newUser, error: createError } =
      await supabase.auth.admin.createUser({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        email_confirm: true, // Skip email verification
        user_metadata: {
          full_name: 'Test Admin',
          role: 'superadmin',
        },
      })

    if (createError) {
      console.error('   ❌ Failed to create test user:', createError.message)
      throw new Error(`Global setup failed: ${createError.message}`)
    }

    console.log(
      `   ✅ Test user created (id: ${newUser.user.id.slice(0, 8)}...)`
    )

    // Give the trigger a moment to create the profile
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  // Verify we can sign in with the test credentials
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  })

  if (signInError) {
    console.error(
      '   ❌ Test user sign-in verification failed:',
      signInError.message
    )
    throw new Error(`Global setup sign-in check failed: ${signInError.message}`)
  }

  console.log('   ✅ Sign-in verification passed')

  // Ensure admin user has no pending requirements (password change, etc.) that
  // would prevent reaching the dashboard during tests.
  const adminUserId = existingUser?.id
  if (adminUserId) {
    await supabase
      .from('users')
      .update({ password_change_required: false })
      .eq('id', adminUserId)
    console.log('   ✅ Admin password_change_required cleared')
  }

  // ── Ensure admin has a TOTP factor enrolled ─────────────────────────────
  // The app enforces MFA at the component level. Tests need to be able to
  // complete the TOTP challenge on the login page. We enroll a factor with a
  // known secret and store it so loginAs() can compute codes at runtime.
  //
  // When MFA enforcement is disabled (e.g. dev environment) skip this entirely.
  if (process.env.NEXT_PUBLIC_DISABLE_MFA_ENFORCEMENT) {
    console.log('   ⏭️  MFA enforcement disabled — skipping TOTP enrollment')
    console.log('   🚀 Global setup complete\n')
    return
  }

  console.log('   🔐 Checking admin MFA (TOTP) enrollment...')

  try {
    // Build a fresh client that will hold the user session (not admin-only)
    const userClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { error: uSignInErr } = await userClient.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })

    if (uSignInErr) {
      console.warn(
        '   ⚠️ Could not sign in for MFA enrollment:',
        uSignInErr.message
      )
    } else {
      const { data: factorsData } = await userClient.auth.mfa.listFactors()
      const existingFactor = factorsData?.totp?.find(
        (f) => f.status === 'verified'
      )
      let secretOnDisk: string | null = null
      try {
        const saved = JSON.parse(fs.readFileSync(TOTP_SECRET_FILE, 'utf-8'))
        secretOnDisk = saved.secret ?? null
      } catch {
        secretOnDisk = null
      }

      // Validate saved secret matches current factor by generating a test code
      let secretValid = false
      if (existingFactor && secretOnDisk) {
        try {
          const { data: ch } = await userClient.auth.mfa.challenge({
            factorId: existingFactor.id,
          })
          if (ch) {
            const testCode = authenticator.generate(secretOnDisk)
            const { error: vErr } = await userClient.auth.mfa.verify({
              factorId: existingFactor.id,
              challengeId: ch.id,
              code: testCode,
            })
            secretValid = !vErr
          }
        } catch {
          secretValid = false
        }
      }

      if (existingFactor && secretValid) {
        console.log('   ✅ Admin TOTP already enrolled (verified secret on disk)')
      } else {
        // Delete ALL existing TOTP factors (verified AND unverified) via admin API
        // to ensure clean enrollment without "factor name conflict" errors.
        const adminId = existingUser?.id
        if (adminId && factorsData?.totp) {
          for (const factor of factorsData.totp) {
            await fetch(
              `${supabaseUrl}/auth/v1/admin/users/${adminId}/factors/${factor.id}`,
              {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${serviceRoleKey}`,
                  apikey: serviceRoleKey,
                },
              }
            )
            console.log(`   🗑️  Removed ${factor.status} TOTP factor (${factor.friendly_name})`)
          }
        }

        // Enroll a fresh TOTP factor
        const { data: enrollData, error: enrollErr } =
          await userClient.auth.mfa.enroll({
            factorType: 'totp',
            friendlyName: 'E2E Test Authenticator',
          })

        if (enrollErr || !enrollData) {
          console.warn(
            '   ⚠️ TOTP enrollment failed — admin login tests may fail:',
            enrollErr?.message
          )
        } else {
          const totpUri: string = enrollData.totp?.uri ?? ''
          const secretMatch = totpUri.match(/[?&]secret=([A-Z2-7]+)/i)
          const totpSecret = secretMatch?.[1]

          if (!totpSecret) {
            console.warn(
              '   ⚠️ Could not parse TOTP secret from enrollment URI'
            )
          } else {
            // Give the server a moment, then generate + verify the first code
            await new Promise((r) => setTimeout(r, 500))
            let code = authenticator.generate(totpSecret)
            let { data: challenge } = await userClient.auth.mfa.challenge({
              factorId: enrollData.id,
            })

            let verified = false
            if (challenge) {
              const { error: verifyErr } = await userClient.auth.mfa.verify({
                factorId: enrollData.id,
                challengeId: challenge.id,
                code,
              })
              if (!verifyErr) {
                verified = true
              } else {
                // Timing edge case — wait for next TOTP window and retry
                await new Promise((r) => setTimeout(r, 5000))
                code = authenticator.generate(totpSecret)
                const { data: ch2 } = await userClient.auth.mfa.challenge({
                  factorId: enrollData.id,
                })
                if (ch2) {
                  const { error: v2 } = await userClient.auth.mfa.verify({
                    factorId: enrollData.id,
                    challengeId: ch2.id,
                    code,
                  })
                  if (!v2) verified = true
                }
              }
            }

            if (verified) {
              fs.writeFileSync(
                TOTP_SECRET_FILE,
                JSON.stringify({ secret: totpSecret, factorId: enrollData.id })
              )
              console.log(
                `   ✅ Admin TOTP enrolled — secret saved to ${path.basename(TOTP_SECRET_FILE)}`
              )
            } else {
              console.warn(
                '   ⚠️ TOTP verification failed — admin login tests may fail'
              )
            }
          }
        }
      }
    }
  } catch (mfaErr) {
    console.warn('   ⚠️ MFA setup error (non-fatal):', mfaErr)
  }

  console.log('   🚀 Global setup complete\n')
}
