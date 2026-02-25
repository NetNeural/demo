const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://atgbmxicqikmapfqouco.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function forceFix() {
  console.log('🔧 Force-fixing storage policies...\n')

  // First, check what policies exist
  console.log('1️⃣ Checking existing policies...')
  const checkQuery = `
    SELECT policyname, cmd, qual, with_check
    FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects';
  `

  const { data: existing } = await supabase.rpc('exec_sql', {
    query: checkQuery,
  })
  if (existing && existing.length > 0) {
    console.log(`   Found ${existing.length} policies:\n`)
    existing.forEach((p) => {
      console.log(`   • ${p.policyname} (${p.cmd})`)
      if (p.qual && p.qual.includes('foldername')) {
        console.log(`     ⚠️  Uses storage.foldername() - NEEDS FIXING`)
      }
      if (p.with_check && p.with_check.includes('foldername')) {
        console.log(
          `     ⚠️  WITH CHECK uses storage.foldername() - NEEDS FIXING`
        )
      }
    })
  }

  // Drop ALL policies on storage.objects
  console.log('\n2️⃣ Dropping ALL storage.objects policies...')
  const dropAll = `
    DO $$
    DECLARE
      r RECORD;
    BEGIN
      FOR r IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects'
      LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON storage.objects';
        RAISE NOTICE 'Dropped: %', r.policyname;
      END LOOP;
    END $$;
  `

  const { error: dropError } = await supabase.rpc('exec_sql', {
    query: dropAll,
  })
  if (dropError) {
    console.log(`   ❌ Error: ${dropError.message}`)
  } else {
    console.log(`   ✅ All old policies dropped`)
  }

  await new Promise((resolve) => setTimeout(resolve, 500))

  // Create new policies with split_part()
  console.log('\n3️⃣ Creating new policies...')

  const policies = [
    {
      name: 'Anyone can view organization assets',
      sql: `CREATE POLICY "Anyone can view organization assets"
            ON storage.objects FOR SELECT TO authenticated
            USING (bucket_id = 'organization-assets')`,
    },
    {
      name: 'Organization owners can upload assets',
      sql: `CREATE POLICY "Organization owners can upload assets"
            ON storage.objects FOR INSERT TO authenticated
            WITH CHECK (
              bucket_id = 'organization-assets' AND EXISTS (
                SELECT 1 FROM organization_members om
                WHERE om.user_id = auth.uid() AND om.role = 'owner'
                AND om.organization_id::text = split_part(name, '/', 1)
              )
            )`,
    },
    {
      name: 'Organization owners can update assets',
      sql: `CREATE POLICY "Organization owners can update assets"
            ON storage.objects FOR UPDATE TO authenticated
            USING (
              bucket_id = 'organization-assets' AND EXISTS (
                SELECT 1 FROM organization_members om
                WHERE om.user_id = auth.uid() AND om.role = 'owner'
                AND om.organization_id::text = split_part(name, '/', 1)
              )
            )`,
    },
    {
      name: 'Organization owners can delete assets',
      sql: `CREATE POLICY "Organization owners can delete assets"
            ON storage.objects FOR DELETE TO authenticated
            USING (
              bucket_id = 'organization-assets' AND EXISTS (
                SELECT 1 FROM organization_members om
                WHERE om.user_id = auth.uid() AND om.role = 'owner'
                AND om.organization_id::text = split_part(name, '/', 1)
              )
            )`,
    },
  ]

  for (const policy of policies) {
    const { error } = await supabase.rpc('exec_sql', { query: policy.sql })
    if (error) {
      console.log(`   ❌ ${policy.name}: ${error.message}`)
    } else {
      console.log(`   ✅ ${policy.name}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  // Verify final state
  console.log('\n4️⃣ Verifying new policies...')
  const { data: final } = await supabase.rpc('exec_sql', { query: checkQuery })
  if (final && final.length > 0) {
    console.log(`   ✅ ${final.length} policies active:\n`)
    final.forEach((p) => {
      console.log(`   • ${p.policyname}`)
      if (
        p.qual &&
        (p.qual.includes('foldername') || p.with_check.includes('foldername'))
      ) {
        console.log(`     ❌ STILL HAS FOLDERNAME - PROBLEM!`)
      }
    })
  }

  console.log('\n✅ Done! Try uploading now.')
}

forceFix().catch(console.error)
