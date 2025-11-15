#!/usr/bin/env node
/**
 * Query Golioth Integration from Local AND Production Supabase
 * This uses the connection strings we know work
 */

const { Client } = require('pg');

const QUERY = `
  SELECT 
    id,
    organization_id,
    name,
    project_id,
    base_url,
    CASE 
      WHEN api_key_encrypted IS NOT NULL THEN 'PRESENT (' || length(api_key_encrypted) || ' chars)'
      ELSE 'MISSING'
    END as api_key_status,
    settings::text as settings_json,
    status,
    created_at,
    updated_at
  FROM device_integrations 
  WHERE integration_type = 'golioth'
  LIMIT 1;
`;

async function queryDatabase(name, config) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 Querying ${name}...`);
  console.log(`${'='.repeat(60)}\n`);

  const client = new Client(config);

  try {
    await client.connect();
    console.log('✅ Connected\n');

    const result = await client.query(QUERY);

    if (result.rows.length === 0) {
      console.log('❌ No Golioth integration found\n');
      return null;
    }

    const integration = result.rows[0];
    console.log('📋 Integration Details:');
    console.log('  ID:', integration.id);
    console.log('  Organization ID:', integration.organization_id);
    console.log('  Name:', integration.name);
    console.log('  Project ID:', integration.project_id || '❌ MISSING');
    console.log('  Base URL:', integration.base_url || '❌ MISSING');
    console.log('  API Key Status:', integration.api_key_status);
    console.log('  Status:', integration.status);
    console.log('\n📦 Settings JSON:');
    console.log(integration.settings_json || 'null');
    console.log('\n📅 Timestamps:');
    console.log('  Created:', integration.created_at);
    console.log('  Updated:', integration.updated_at);

    // Device count
    const deviceCount = await client.query(
      'SELECT COUNT(*) as count FROM devices WHERE integration_id = $1',
      [integration.id]
    );
    console.log('\n📊 Linked Devices:', deviceCount.rows[0].count);

    return integration;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return null;
  } finally {
    await client.end();
  }
}

async function main() {
  console.log('🚀 Golioth Integration Comparison\n');

  // Query local
  const local = await queryDatabase('LOCAL SUPABASE', {
    host: 'localhost',
    port: 54322,
    database: 'postgres',
    user: 'postgres',
    password: 'postgres',
  });

  // Query production using pooler (requires SUPABASE_DB_PASSWORD env var)
  const prodPassword = process.env.SUPABASE_DB_PASSWORD;
  
  if (!prodPassword) {
    console.log('\n⚠️  Skipping production query (SUPABASE_DB_PASSWORD not set)');
    console.log('   Get password from: https://supabase.com/dashboard/project/bldojxpockljyivldxwf/settings/database');
    console.log('   Then run: export SUPABASE_DB_PASSWORD="your-password"');
  } else {
    const production = await queryDatabase('PRODUCTION SUPABASE', {
      host: 'db.bldojxpockljyivldxwf.supabase.co',
      port: 6543, // Transaction pooler
      database: 'postgres',
      user: 'postgres.bldojxpockljyivldxwf',
      password: prodPassword,
      ssl: { rejectUnauthorized: false },
    });

    // Compare
    if (local && production) {
      console.log(`\n${'='.repeat(60)}`);
      console.log('🔬 COMPARISON');
      console.log(`${'='.repeat(60)}\n`);
      
      const fields = ['project_id', 'api_key_status', 'settings_json', 'status'];
      fields.forEach(field => {
        const match = local[field] === production[field];
        console.log(`  ${field}:`);
        console.log(`    Local: ${local[field]}`);
        console.log(`    Prod:  ${production[field]}`);
        console.log(`    Match: ${match ? '✅' : '❌'}\n`);
      });
    }
  }
}

main();
