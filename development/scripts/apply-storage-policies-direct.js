const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://atgbmxicqikmapfqouco.supabase.co',
  process.env.STAGE_SUPABASE_SERVICE_ROLE_KEY || ''
)

async function applyPolicies() {
  console.log('Applying storage policies for organization-assets bucket...\n')

  const policies = [
    {
      name: 'DROP existing policies',
      sql: `
        DROP POLICY IF EXISTS "Anyone can view organization assets" ON storage.objects;
        DROP POLICY IF EXISTS "Organization owners can upload assets" ON storage.objects;
        DROP POLICY IF EXISTS "Organization owners can update assets" ON storage.objects;
        DROP POLICY IF EXISTS "Organization owners can delete assets" ON storage.objects;
      `,
    },
    {
      name: 'Allow authenticated users to view',
      sql: `
        CREATE POLICY "Anyone can view organization assets"
        ON storage.objects FOR SELECT
        TO authenticated
        USING (bucket_id = 'organization-assets');
      `,
    },
    {
      name: 'Allow organization owners to upload',
      sql: `
        CREATE POLICY "Organization owners can upload assets"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (
          bucket_id = 'organization-assets'
          AND (storage.foldername(name))[1]::uuid IN (
            SELECT o.id
            FROM organizations o
            INNER JOIN organization_members om ON o.id = om.organization_id
            WHERE om.user_id = auth.uid()
              AND om.role = 'owner'
          )
        );
      `,
    },
    {
      name: 'Allow organization owners to update',
      sql: `
        CREATE POLICY "Organization owners can update assets"
        ON storage.objects FOR UPDATE
        TO authenticated
        USING (
          bucket_id = 'organization-assets'
          AND (storage.foldername(name))[1]::uuid IN (
            SELECT o.id
            FROM organizations o
            INNER JOIN organization_members om ON o.id = om.organization_id
            WHERE om.user_id = auth.uid()
              AND om.role = 'owner'
          )
        );
      `,
    },
    {
      name: 'Allow organization owners to delete',
      sql: `
        CREATE POLICY "Organization owners can delete assets"
        ON storage.objects FOR DELETE
        TO authenticated
        USING (
          bucket_id = 'organization-assets'
          AND (storage.foldername(name))[1]::uuid IN (
            SELECT o.id
            FROM organizations o
            INNER JOIN organization_members om ON o.id = om.organization_id
            WHERE om.user_id = auth.uid()
              AND om.role = 'owner'
          )
        );
      `,
    },
  ]

  for (const policy of policies) {
    console.log(`Applying: ${policy.name}...`)

    try {
      // Use the Supabase admin client to execute raw SQL
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: policy.sql,
      })

      if (error) {
        // Try alternative: direct SQL execution via PostgREST
        const response = await fetch(
          'https://atgbmxicqikmapfqouco.supabase.co/rest/v1/rpc/exec_sql',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: process.env.STAGE_SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${process.env.STAGE_SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ sql: policy.sql }),
          }
        )

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`)
        }

        console.log('✅ Success (via REST)')
      } else {
        console.log('✅ Success')
      }
    } catch (err) {
      console.error(`❌ Error: ${err.message}`)
      console.log('Continuing to next policy...\n')
    }
  }

  console.log('\n=== Manual Application Required ===')
  console.log(
    'If automated application failed, please manually apply the policies:'
  )
  console.log(
    '1. Go to: https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/sql/new'
  )
  console.log(
    '2. Copy the SQL from: development/supabase/migrations/20260216000001_apply_storage_policies.sql'
  )
  console.log('3. Run it in the SQL editor')
}

applyPolicies().catch(console.error)
