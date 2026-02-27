/**
 * Global Teardown for Playwright Tests
 *
 * Cleans up the test user created during global setup.
 * Set KEEP_TEST_USER=true to preserve the user between runs (faster iteration).
 */
import { createClient } from '@supabase/supabase-js'

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
const LOCAL_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'admin@netneural.ai'

export default async function globalTeardown() {
  // Skip cleanup if asked to keep the user (faster local dev iteration)
  if (process.env.KEEP_TEST_USER === 'true') {
    console.log('\n🧹 Teardown: Keeping test user (KEEP_TEST_USER=true)\n')
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || LOCAL_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || LOCAL_SERVICE_ROLE_KEY

  console.log('\n🧹 Playwright Global Teardown')

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: users } = await supabase.auth.admin.listUsers()
    const testUser = users?.users?.find((u) => u.email === TEST_EMAIL)

    if (testUser) {
      // Delete profile from public.users first (FK constraint)
      await supabase.from('users').delete().eq('id', testUser.id)

      // Delete auth user
      const { error } = await supabase.auth.admin.deleteUser(testUser.id)
      if (error) {
        console.log(`   ⚠️  Could not delete test user: ${error.message}`)
      } else {
        console.log(`   ✅ Test user deleted (${TEST_EMAIL})`)
      }
    } else {
      console.log('   ℹ️  Test user not found (already cleaned up)')
    }
  } catch (err) {
    // Non-fatal — Supabase may already be stopped
    console.log(`   ⚠️  Teardown skipped: ${(err as Error).message}`)
  }

  console.log('   🧹 Teardown complete\n')
}
