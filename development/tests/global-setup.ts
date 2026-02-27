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

// Well-known local Supabase CLI keys (safe to commit — only work on localhost)
const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
const LOCAL_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

// Default test user credentials (must match what test specs use)
const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'admin@netneural.ai'
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'password123'

export default async function globalSetup() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || LOCAL_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || LOCAL_SERVICE_ROLE_KEY

  console.log(`\n🔧 Playwright Global Setup`)
  console.log(`   Supabase URL: ${supabaseUrl}`)
  console.log(`   Test user:    ${TEST_EMAIL}`)

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Check if test user already exists
  const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers()

  if (listError) {
    console.error('   ❌ Failed to list users — is Supabase running?', listError.message)
    console.error('   💡 Start Supabase: cd development && npx supabase start')
    throw new Error(`Global setup failed: ${listError.message}`)
  }

  const existingUser = existingUsers?.users?.find((u) => u.email === TEST_EMAIL)

  if (existingUser) {
    console.log(`   ✅ Test user already exists (id: ${existingUser.id.slice(0, 8)}...)`)
  } else {
    // Create the test user via admin API
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
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

    console.log(`   ✅ Test user created (id: ${newUser.user.id.slice(0, 8)}...)`)

    // Give the trigger a moment to create the profile
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  // Verify we can sign in with the test credentials
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  })

  if (signInError) {
    console.error('   ❌ Test user sign-in verification failed:', signInError.message)
    throw new Error(`Global setup sign-in check failed: ${signInError.message}`)
  }

  console.log('   ✅ Sign-in verification passed')
  console.log('   🚀 Global setup complete\n')
}
