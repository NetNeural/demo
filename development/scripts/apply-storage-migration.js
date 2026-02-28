const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://atgbmxicqikmapfqouco.supabase.co',
  process.env.STAGE_SUPABASE_SERVICE_ROLE_KEY || ''
)

async function applyMigration() {
  console.log('Applying organization branding storage migration...\n')

  // The migration SQL
  const migrationSQL = `
-- Create storage bucket for organization assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'organization-assets',
  'organization-assets',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
) ON CONFLICT (id) DO NOTHING;
`

  try {
    // Check if bucket already exists
    const { data: buckets, error: listError } =
      await supabase.storage.listBuckets()

    if (listError) {
      console.error('Error listing buckets:', listError)
      return
    }

    const bucketExists = buckets.some((b) => b.id === 'organization-assets')

    if (bucketExists) {
      console.log('✅ Storage bucket "organization-assets" already exists')
    } else {
      // Create the bucket programmatically
      const { data: newBucket, error: createError } =
        await supabase.storage.createBucket('organization-assets', {
          public: true,
          fileSizeLimit: 5242880, // 5MB
          allowedMimeTypes: [
            'image/png',
            'image/jpeg',
            'image/jpg',
            'image/webp',
            'image/svg+xml',
          ],
        })

      if (createError) {
        console.error('Error creating bucket:', createError)
        return
      }

      console.log('✅ Created storage bucket "organization-assets"')
    }

    console.log('\nStorage bucket configuration:')
    console.log('  - ID: organization-assets')
    console.log('  - Public: Yes (authenticated users can read)')
    console.log('  - Max file size: 5MB')
    console.log('  - Allowed types: PNG, JPG, WebP, SVG')
    console.log(
      '\nNote: Storage policies need to be configured via Supabase Dashboard:'
    )
    console.log(
      '  https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/storage/policies'
    )
    console.log('\nRequired policies:')
    console.log('  1. SELECT: Anyone can view organization assets')
    console.log('  2. INSERT: Organization owners can upload')
    console.log('  3. UPDATE: Organization owners can update')
    console.log('  4. DELETE: Organization owners can delete')
  } catch (error) {
    console.error('Error applying migration:', error)
  }
}

applyMigration().catch(console.error)
