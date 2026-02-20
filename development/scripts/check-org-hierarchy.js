#!/usr/bin/env node

const STAGING_URL = 'https://atgbmxicqikmapfqouco.supabase.co'
const STAGING_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

async function checkHierarchy() {
  console.log('🏢 Checking organization hierarchy...\n')

  const response = await fetch(
    `${STAGING_URL}/rest/v1/organizations?select=id,name,slug,parent_organization_id&order=name.asc`,
    {
      headers: {
        apikey: STAGING_SERVICE_KEY,
        Authorization: `Bearer ${STAGING_SERVICE_KEY}`,
      },
    }
  )

  if (!response.ok) {
    console.error('❌ Failed to fetch organizations:', await response.text())
    process.exit(1)
  }

  const orgs = await response.json()

  console.log('Organization Hierarchy:')
  console.log('═'.repeat(80))

  const rootOrgs = orgs.filter((o) => !o.parent_organization_id)
  const childOrgs = orgs.filter((o) => o.parent_organization_id)

  console.log('\n📍 ROOT ORGANIZATIONS (parent_organization_id IS NULL):')
  rootOrgs.forEach((org) => {
    console.log(`  • ${org.name} (${org.slug})`)
    console.log(`    ID: ${org.id}`)

    // Find children
    const children = childOrgs.filter(
      (c) => c.parent_organization_id === org.id
    )
    if (children.length > 0) {
      console.log(`    └─ Children (${children.length}):`)
      children.forEach((child) => {
        console.log(`       • ${child.name} (${child.slug})`)
      })
    }
    console.log('')
  })

  console.log('\n👥 CHILD ORGANIZATIONS (have a parent):')
  childOrgs.forEach((org) => {
    const parent = orgs.find((o) => o.id === org.parent_organization_id)
    console.log(`  • ${org.name} (${org.slug})`)
    console.log(`    ID: ${org.id}`)
    console.log(
      `    Parent: ${parent ? parent.name : org.parent_organization_id}`
    )
    console.log('')
  })

  console.log('═'.repeat(80))
  console.log(
    `📊 Summary: ${rootOrgs.length} root orgs, ${childOrgs.length} child orgs`
  )
}

checkHierarchy().catch(console.error)
