// Check if permissions are set on password_change_required column
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://atgbmxicqikmapfqouco.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0Z2JteGljcWlrbWFwZnFvdWNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTAxNzgwOSwiZXhwIjoyMDg2NTkzODA5fQ.xmXj7FHnPfYQIY5dFwAqCK4KvHT5VuiARzrYFFEMVog'

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
