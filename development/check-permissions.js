// Check if permissions are set on password_change_required column
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://atgbmxicqikmapfqouco.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkPermissions() {
  console.log('Checking column permissions...\n')
  
  // Check if grants exist
  const { data, error } = await supabase
    .from('information_schema.column_privileges')
    .select('*')
    .eq('table_name', 'users')
    .eq('column_name', 'password_change_required')
  
  if (error) {
    console.error('Error checking permissions:', error)
    console.log('\n❌ Could not check permissions')
    return
  }
  
  if (!data || data.length === 0) {
    console.log('❌ NO PERMISSIONS FOUND for password_change_required column')
    console.log('\nYou need to run this SQL:')
    console.log('```sql')
    console.log('GRANT SELECT (password_change_required) ON users TO authenticated;')
    console.log('GRANT UPDATE (password_change_required) ON users TO authenticated;')
    console.log('```')
  } else {
    console.log('✅ Permissions found:')
    console.log(data)
  }
}

checkPermissions()
