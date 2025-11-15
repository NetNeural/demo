#!/usr/bin/env node
/**
 * Query Golioth Integration from Local Supabase
 * Run: node scripts/query-golioth-integration.js
 */

const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 54322,
  database: 'postgres',
  user: 'postgres',
  password: 'postgres',
});

async function queryGoliothIntegration() {
  try {
    await client.connect();
    console.log('✅ Connected to local Supabase\n');

    // Query Golioth integration details
    const result = await client.query(`
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
    `);

    if (result.rows.length === 0) {
      console.log('❌ No Golioth integration found in database');
      return;
    }

    const integration = result.rows[0];
    console.log('🔍 Golioth Integration Details:\n');
    console.log('ID:', integration.id);
    console.log('Organization ID:', integration.organization_id);
    console.log('Name:', integration.name);
    console.log('Project ID:', integration.project_id || 'MISSING');
    console.log('Base URL:', integration.base_url || 'MISSING');
    console.log('API Key Status:', integration.api_key_status);
    console.log('Status:', integration.status);
    console.log('\nSettings JSON:');
    console.log(integration.settings_json || 'null');
    console.log('\nCreated:', integration.created_at);
    console.log('Updated:', integration.updated_at);

    // Also check device count
    const deviceCount = await client.query(`
      SELECT COUNT(*) as count
      FROM devices
      WHERE integration_id = $1;
    `, [integration.id]);

    console.log('\n📊 Linked Devices:', deviceCount.rows[0].count);

    // Diagnostic output for device-sync fix
    console.log('\n🔧 Diagnostic for device-sync fix:');
    const hasApiKey = integration.api_key_status.startsWith('PRESENT');
    const hasProjectId = !!integration.project_id;
    const hasSettings = integration.settings_json && integration.settings_json !== 'null';
    
    console.log('  ✓ Has API key in api_key_encrypted:', hasApiKey ? '✅' : '❌');
    console.log('  ✓ Has project_id column:', hasProjectId ? '✅' : '❌');
    console.log('  ✓ Has settings JSON:', hasSettings ? '✅' : '❌');

    if (hasSettings) {
      try {
        const settings = JSON.parse(integration.settings_json);
        console.log('  ✓ Settings contains apiKey:', !!settings.apiKey ? '✅' : '❌');
        console.log('  ✓ Settings contains projectId:', !!settings.projectId ? '✅' : '❌');
      } catch (e) {
        console.log('  ⚠️  Settings JSON parse error:', e.message);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

queryGoliothIntegration();
