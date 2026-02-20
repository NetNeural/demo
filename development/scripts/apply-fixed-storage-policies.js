const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabase = createClient(
  'https://atgbmxicqikmapfqouco.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function applyPolicies() {
  console.log('🔧 Applying fixed storage policies...\n')

  const sql = fs.readFileSync(
    './supabase/migrations/20260216000002_fix_storage_policies.sql',
    'utf8'
  )

  // Split by semicolon and execute each statement
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'))

  for (const statement of statements) {
    console.log(`Executing: ${statement.substring(0, 60)}...`)

    const { error } = await supabase.rpc('exec_sql', {
      query: statement + ';',
    })

    if (error) {
      console.log(`❌ Error: ${error.message}`)
    } else {
      console.log('✅ Success')
    }
  }

  console.log('\n🎉 Done! Checking policies...')

  // Verify policies
  const { data: policies, error: polError } = await supabase.rpc('exec_sql', {
    query: `
      SELECT policyname, cmd 
      FROM pg_policies 
      WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname LIKE '%organization%';
    `,
  })

  if (!polError && policies) {
    console.log('\n✅ Active policies:', policies)
  }
}

applyPolicies().catch(console.error)
