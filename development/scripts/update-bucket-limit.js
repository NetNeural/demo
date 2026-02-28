const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://atgbmxicqikmapfqouco.supabase.co',
  process.env.STAGE_SUPABASE_SERVICE_ROLE_KEY || ''
)

async function updateBucketLimit() {
  console.log('Updating organization-assets bucket file size limit...\n')

  try {
    // Update bucket to have 512KB limit
    const { data, error } = await supabase.storage.updateBucket(
      'organization-assets',
      {
        public: true,
        fileSizeLimit: 524288, // 512KB (industry best practice for logos)
        allowedMimeTypes: [
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/webp',
          'image/svg+xml',
        ],
      }
    )

    if (error) {
      console.error('Error updating bucket:', error)
      return
    }

    console.log('✅ Bucket updated successfully!')
    console.log('New configuration:')
    console.log('  - File size limit: 512KB (was 5MB)')
    console.log(
      '  - Rationale: Logos compressed to WebP at 400x400px typically <200KB'
    )
    console.log('  - This saves storage costs and improves page load times')

    // Verify the update
    const { data: buckets } = await supabase.storage.listBuckets()
    const orgBucket = buckets?.find((b) => b.id === 'organization-assets')

    if (orgBucket) {
      console.log('\nVerified configuration:')
      console.log(`  - Size limit: ${orgBucket.file_size_limit / 1024}KB`)
      console.log(`  - Public: ${orgBucket.public}`)
      console.log(
        `  - Allowed types: ${orgBucket.allowed_mime_types?.join(', ')}`
      )
    }
  } catch (error) {
    console.error('Error:', error)
  }
}

updateBucketLimit().catch(console.error)
