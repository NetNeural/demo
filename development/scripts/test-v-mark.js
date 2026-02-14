const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://atgbmxicqikmapfqouco.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0Z2JteGljcWlrbWFwZnFvdWNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTAxNzgwOSwiZXhwIjoyMDg2NTkzODA5fQ.tGj8TfFUR3DiXWEYT1Lt41zvzxb5HipUnpfF-QfHbjY'

console.log('🧪 Testing V-Mark organization creation via edge function...\n')

async function testCreate() {
  const response = await fetch(`${supabaseUrl}/functions/v1/organizations`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'V-Mark',
      slug: 'v-mark',
      description: 'Test organization for multi-tenancy'
    })
  })
  
  console.log('Response status:', response.status)
  const data = await response.json()
  console.log('Response:', JSON.stringify(data, null, 2))
  
  if (response.ok) {
    console.log('\n✅ SUCCESS! Organization created')
    
    // Verify it's in the database
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { data: orgs } = await supabase.from('organizations').select('id, name, slug').order('created_at', { ascending: false }).limit(3)
    console.log('\nLatest organizations:')
    orgs.forEach(org => console.log(`  - ${org.name} (${org.slug})`))
  } else {
    console.log('\n❌ FAILED')
  }
}

testCreate().catch(console.error)
