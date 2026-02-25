const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://atgbmxicqikmapfqouco.supabase.co',
  'YOUR_SUPABASE_SERVICE_ROLE_KEY'
)

async function checkStorageSchema() {
  console.log('🔍 Checking storage schema...\n')
  
  // Check storage.objects table structure
  const { data: columns, error: colError } = await supabase.rpc('exec_sql', {
    query: `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'storage' 
      AND table_name = 'objects'
      ORDER BY ordinal_position;
    `
  })
  
  if (colError) {
    console.log('❌ Error checking columns (trying alternative):', colError.message)
    
    // Try direct query
    const { data: objects, error: objError } = await supabase
      .from('storage.objects')
      .select('*')
      .limit(1)
    
    console.log('Storage objects query result:', objError ? objError : 'Success')
  } else {
    console.log('✅ Storage.objects columns:', columns)
  }
  
  // Check if organization_id column exists
  const { data: orgCol, error: orgColError } = await supabase.rpc('exec_sql', {
    query: `
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'storage' 
        AND table_name = 'objects'
        AND column_name = 'organization_id'
      );
    `
  })
  
  console.log('\n📋 Checking organization_id column:', orgCol ? 'Exists' : 'Missing')
  
  // Check storage policies on objects table
  const { data: storagePolicies, error: policiesError } = await supabase.rpc('exec_sql', {
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
      WHERE schemaname = 'storage' 
      AND tablename = 'objects';
    `
  })
  
  if (policiesError) {
    console.log('\n❌ Error getting storage policies:', policiesError.message)
  } else {
    console.log('\n📜 Storage policies on storage.objects:')
    storagePolicies?.forEach(p => {
      console.log(`  - ${p.policyname} (${p.cmd})`)
      console.log(`    USING: ${p.qual}`)
      console.log(`    WITH CHECK: ${p.with_check}`)
    })
  }
}

checkStorageSchema().catch(console.error)
