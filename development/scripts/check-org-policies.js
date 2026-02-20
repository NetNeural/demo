const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://atgbmxicqikmapfqouco.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

async function checkPolicies() {
  console.log('🔍 Checking RLS policies for organizations table...\n')

  // Query pg_policies view
  const { data: policies, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT 
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies 
      WHERE tablename = 'organizations'
      ORDER BY cmd, policyname;
    `,
  })

  if (error) {
    // Try direct query instead
    console.log('RPC failed, trying direct SQL query...')
    const { data, error: sqlError } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'organizations')

    if (sqlError) {
      console.error('❌ Error:', sqlError)
      console.log('\n💡 Trying to test INSERT directly with service role...')

      // Test if we can insert directly
      const testOrg = {
        name: 'Test Org',
        slug: 'test-org-' + Date.now(),
        description: 'Test',
        subscription_tier: 'starter',
        is_active: true,
        settings: {},
      }

      const { data: inserted, error: insertError } = await supabase
        .from('organizations')
        .insert(testOrg)
        .select()
        .single()

      if (insertError) {
        console.error('❌ Service role INSERT FAILED:', insertError)
        console.log('\n🚨 This confirms RLS is blocking even service role!')
      } else {
        console.log('✅ Service role INSERT SUCCEEDED:', inserted)
        console.log(
          '\n💡 Service role CAN insert, so the issue is in the edge function client setup'
        )
      }
      return
    }
  }

  console.log('Found policies:', policies)
}

checkPolicies().catch(console.error)
