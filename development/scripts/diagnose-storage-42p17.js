#!/usr/bin/env node
/**
 * Diagnose PostgreSQL error 42P17 (invalid_object_definition)
 * in Supabase Storage
 */

const { createClient } = require('@supabase/supabase-js')

const STAGING_URL = 'https://atgbmxicqikmapfqouco.supabase.co'
const SERVICE_KEY = process.env.STAGE_SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_KEY) {
  console.error(
    '❌ Missing STAGE_SUPABASE_SERVICE_ROLE_KEY environment variable'
  )
  process.exit(1)
}

const supabase = createClient(STAGING_URL, SERVICE_KEY)

async function diagnose() {
  console.log('🔍 Diagnosing Storage Error 42P17\n')
  console.log('Environment: Staging')
  console.log('URL:', STAGING_URL)
  console.log('---\n')

  // 1. Check if bucket exists
  console.log('1️⃣ Checking if bucket exists...')
  const { data: buckets, error: listError } =
    await supabase.storage.listBuckets()

  if (listError) {
    console.error('❌ Error listing buckets:', listError)
    return
  }

  const orgBucket = buckets.find((b) => b.id === 'organization-assets')

  if (!orgBucket) {
    console.log('❌ Bucket "organization-assets" NOT FOUND')
    console.log('   Available buckets:', buckets.map((b) => b.id).join(', '))
    console.log('\n🔧 FIX: Run the bucket creation script')
    console.log('   node scripts/apply-storage-migration.js\n')
    return
  }

  console.log('✅ Bucket exists')
  console.log('   Config:', JSON.stringify(orgBucket, null, 2))

  // 2. Check bucket configuration in database
  console.log('\n2️⃣ Checking bucket database configuration...')
  const { data: dbBucket, error: dbError } = await supabase
    .from('buckets')
    .select('*')
    .eq('id', 'organization-assets')
    .maybeSingle()

  if (dbError) {
    console.log('⚠️  Error querying buckets table:', dbError.message)
    console.log('   This might be expected if RLS prevents service role access')
  } else if (!dbBucket) {
    console.log('❌ Bucket not found in storage.buckets table')
    console.log('   This is the cause of error 42P17!')
    console.log('\n🔧 FIX: Recreate bucket using SQL migration')
  } else {
    console.log('✅ Bucket found in database')
    console.log('   Public:', dbBucket.public)
    console.log('   File size limit:', dbBucket.file_size_limit)
  }

  // 3. Check storage policies
  console.log('\n3️⃣ Checking storage policies...')
  const { data: policies, error: policyError } = await supabase
    .rpc('get_storage_policies', {
      bucket_name: 'organization-assets',
    })
    .catch(async () => {
      // Fallback: try direct query
      return await supabase
        .from('policies')
        .select('*')
        .eq('table_name', 'objects')
    })

  if (policyError) {
    console.log('⚠️  Could not check policies:', policyError.message)
    console.log('   Manual check needed via Supabase Dashboard')
  } else if (!policies || policies.length === 0) {
    console.log('❌ No storage policies found for storage.objects')
    console.log('   This prevents file uploads!')
    console.log('\n🔧 FIX: Apply storage policies')
    console.log('   node scripts/apply-storage-policies-direct.js\n')
  } else {
    console.log(`✅ Found ${policies.length} policies`)
  }

  // 4. Test upload permission
  console.log('\n4️⃣ Testing upload capability...')
  const testFile = Buffer.from('test')
  const { data: uploadTest, error: uploadError } = await supabase.storage
    .from('organization-assets')
    .upload('test-00000000-0000-0000-0000-000000000001/test.txt', testFile, {
      upsert: true,
    })

  if (uploadError) {
    console.log('❌ Upload test failed:', uploadError.message)
    if (uploadError.message.includes('42P17')) {
      console.log('\n🎯 CONFIRMED: Error 42P17 - invalid_object_definition')
      console.log(
        '   This means the storage.objects table or bucket reference is broken'
      )
      console.log('\n🔧 FIXES TO TRY:')
      console.log('   1. Run migration to recreate bucket:')
      console.log('      cd /workspaces/MonoRepo/development')
      console.log('      npx supabase db push')
      console.log('   2. Or manually fix via SQL:')
      console.log('      DROP TABLE IF EXISTS storage.objects CASCADE;')
      console.log('      -- Then run Supabase migrations again')
    }
  } else {
    console.log('✅ Upload test succeeded')
    console.log('   File:', uploadTest.path)

    // Clean up test file
    await supabase.storage
      .from('organization-assets')
      .remove(['test-00000000-0000-0000-0000-000000000001/test.txt'])
  }

  console.log('\n✅ Diagnosis complete\n')
}

diagnose().catch(console.error)
