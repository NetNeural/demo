#!/usr/bin/env node
/**
 * Check organizations in staging database
 */

const STAGING_URL = "https://atgbmxicqikmapfqouco.supabase.co";
const STAGING_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0Z2JteGljcWlrbWFwZnFvdWNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTAxNzgwOSwiZXhwIjoyMDg2NTkzODA5fQ.tGj8TfFUR3DiXWEYT1Lt41zvzxb5HipUnpfF-QfHbjY";

async function checkOrgs() {
  console.log('🔍 Checking organizations in staging database...\n');
  
  // Query organizations table
  const response = await fetch(`${STAGING_URL}/rest/v1/organizations?select=*&order=created_at.desc`, {
    headers: {
      'apikey': STAGING_SERVICE_KEY,
      'Authorization': `Bearer ${STAGING_SERVICE_KEY}`,
    },
  });
  
  if (!response.ok) {
    console.error('❌ Failed to fetch organizations:', await response.text());
    process.exit(1);
  }
  
  const orgs = await response.json();
  
  console.log(`Found ${orgs.length} organizations:\n`);
  
  orgs.forEach((org, i) => {
    console.log(`${i + 1}. ${org.name} (${org.slug})`);
    console.log(`   ID: ${org.id}`);
    console.log(`   Tier: ${org.subscription_tier}`);
    console.log(`   Created: ${new Date(org.created_at).toLocaleString()}`);
    console.log('');
  });
  
  // Check if V-Mark exists
  const vmark = orgs.find(o => o.name.toLowerCase().includes('v-mark') || o.slug.includes('v-mark'));
  if (vmark) {
    console.log('✅ V-Mark organization found!');
  } else {
    console.log('❌ V-Mark organization NOT found');
    console.log('   This means the edge function is failing silently');
  }
}

checkOrgs().catch(console.error);
