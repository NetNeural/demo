const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://atgbmxicqikmapfqouco.supabase.co',
  'YOUR_SUPABASE_SERVICE_ROLE_KEY'
)

async function verify() {
  console.log('🔍 Checking storage policies...\n')
  
  const { data, error } = await supabase
    .from('pg_policies')
    .select('schemaname, tablename, policyname, cmd')
    .eq('schemaname', 'storage')
    .eq('tablename', 'objects')
    .ilike('policyname', '%organization%')
  
  if (error) {
    console.log('❌ Error:', error.message)
  } else if (data && data.length > 0) {
    console.log(`✅ Found ${data.length} policies:\n`)
    data.forEach(p => {
      console.log(`  • ${p.policyname} (${p.cmd})`)
    })
    console.log('\n🎉 Policies are active! Try uploading the logo now.')
    console.log('   Remember to hard refresh: Ctrl+Shift+R')
  } else {
    console.log('⚠️  No policies found')
  }
}

verify()
