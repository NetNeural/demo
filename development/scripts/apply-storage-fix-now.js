const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://atgbmxicqikmapfqouco.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fixPolicies() {
  console.log('🔧 Fixing storage policies...\n')

  const statements = [
    `DROP POLICY IF EXISTS "Anyone can view organization assets" ON storage.objects`,
    `DROP POLICY IF EXISTS "Organization owners can upload assets" ON storage.objects`,
    `DROP POLICY IF EXISTS "Organization owners can update assets" ON storage.objects`,
    `DROP POLICY IF EXISTS "Organization owners can delete assets" ON storage.objects`,

    `CREATE POLICY "Anyone can view organization assets"
     ON storage.objects FOR SELECT TO authenticated
     USING (bucket_id = 'organization-assets')`,

    `CREATE POLICY "Organization owners can upload assets"
     ON storage.objects FOR INSERT TO authenticated
     WITH CHECK (
       bucket_id = 'organization-assets' AND EXISTS (
         SELECT 1 FROM organization_members om
         WHERE om.user_id = auth.uid() AND om.role = 'owner'
         AND om.organization_id::text = split_part(name, '/', 1)
       )
     )`,

    `CREATE POLICY "Organization owners can update assets"
     ON storage.objects FOR UPDATE TO authenticated
     USING (
       bucket_id = 'organization-assets' AND EXISTS (
         SELECT 1 FROM organization_members om
         WHERE om.user_id = auth.uid() AND om.role = 'owner'
         AND om.organization_id::text = split_part(name, '/', 1)
       )
     )`,

    `CREATE POLICY "Organization owners can delete assets"
     ON storage.objects FOR DELETE TO authenticated
     USING (
       bucket_id = 'organization-assets' AND EXISTS (
         SELECT 1 FROM organization_members om
         WHERE om.user_id = auth.uid() AND om.role = 'owner'
         AND om.organization_id::text = split_part(name, '/', 1)
       )
     )`,
  ]

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    const label = stmt.substring(0, 50).replace(/\n/g, ' ')
    console.log(`[${i + 1}/${statements.length}] ${label}...`)

    try {
      const { data, error } = await supabase.rpc('exec_sql', { query: stmt })

      if (error) {
        console.log(`  ❌ Error: ${error.message}`)
        if (error.message.includes('does not exist')) {
          console.log('  ℹ️  This is expected for DROP commands')
        }
      } else {
        console.log(`  ✅ Success`)
      }
    } catch (err) {
      console.log(`  ❌ Exception: ${err.message}`)
    }

    // Small delay between operations
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  console.log('\n✅ Done! Now try uploading the logo again.')
}

fixPolicies().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
