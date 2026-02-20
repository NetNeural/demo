#!/usr/bin/env node
/**
 * Backfill 42 standard device types to all existing organizations
 * 
 * Usage: SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/backfill-device-types-all-orgs.js
 */

const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('   For local: Get from `npm run supabase:status`');
  console.error('   For staging: Use staging service role key');
  process.exit(1);
}

/**
 * Make HTTPS request to Supabase
 */
function makeRequest(method, path, body = null) {
  const url = new URL(path, SUPABASE_URL);
  const isHttps = url.protocol === 'https:';
  
  const options = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname + url.search,
    method: method,
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  };

  return new Promise((resolve, reject) => {
    const lib = isHttps ? https : require('http');
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data || '{}') });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * Get all organizations
 */
async function getAllOrganizations() {
  console.log('📋 Fetching all organizations...');
  const result = await makeRequest('GET', '/rest/v1/organizations?select=id,name');
  console.log(`✅ Found ${result.body.length} organizations\n`);
  return result.body;
}

/**
 * Check if organization already has device types
 */
async function getDeviceTypeCount(orgId) {
  const result = await makeRequest('GET', `/rest/v1/device_types?organization_id=eq.${orgId}&select=id`);
  return result.body.length;
}

/**
 * Call the database function to seed device types
 */
async function seedDeviceTypesForOrg(orgId) {
  await makeRequest('POST', '/rest/v1/rpc/seed_organization_device_types', { org_id: orgId });
}

/**
 * Main backfill logic
 */
async function backfillDeviceTypes() {
  console.log('🔧 Backfill Device Types for All Organizations\n');
  console.log(`📡 Supabase URL: ${SUPABASE_URL}\n`);

  try {
    // Get all organizations
    const organizations = await getAllOrganizations();

    if (organizations.length === 0) {
      console.log('ℹ️  No organizations found. Nothing to backfill.');
      return;
    }

    // Process each organization
    let skipped = 0;
    let created = 0;
    let errors = 0;

    for (const org of organizations) {
      try {
        // Check if org already has device types
        const existingCount = await getDeviceTypeCount(org.id);

        if (existingCount > 0) {
          console.log(`⏭️  Skipping "${org.name}" (already has ${existingCount} device types)`);
          skipped++;
          continue;
        }

        // Seed device types
        console.log(`🌱 Seeding device types for "${org.name}"...`);
        await seedDeviceTypesForOrg(org.id);
        
        // Verify creation
        const newCount = await getDeviceTypeCount(org.id);
        console.log(`✅ Created ${newCount} device types for "${org.name}"\n`);
        created++;

      } catch (error) {
        console.error(`❌ Error processing "${org.name}":`, error.message, '\n');
        errors++;
      }
    }

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📊 BACKFILL SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Total organizations: ${organizations.length}`);
    console.log(`✅ Successfully backfilled: ${created}`);
    console.log(`⏭️  Skipped (already had types): ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log('═'.repeat(60) + '\n');

    if (errors > 0) {
      console.error('⚠️  Some organizations failed to backfill. Check errors above.');
      process.exit(1);
    } else {
      console.log('✅ Backfill complete! All organizations now have standard device types.\n');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run backfill
backfillDeviceTypes();
