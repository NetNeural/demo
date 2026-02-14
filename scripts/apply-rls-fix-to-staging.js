#!/usr/bin/env node
/**
 * Apply RLS fix directly to staging database
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'atgbmxicqikmapfqouco';
const SUPABASE_URL = `https://${PROJECT_ID}.supabase.co`;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  console.log('🔧 Applying RLS fix to staging database...');
  console.log(`📍 Project: ${PROJECT_ID}`);
  console.log('');

  // Read the migration file
  const migrationPath = path.join(__dirname, '../development/supabase/migrations/20260214000001_fix_users_rls_circular_dependency.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('📄 Migration SQL:');
  console.log('─'.repeat(60));
  console.log(sql);
  console.log('─'.repeat(60));
  console.log('');

  try {
    // Apply the migration using RPC to execute SQL
    console.log('⚙️  Executing migration...');
    
    // Split into individual statements and execute each
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      if (!statement.trim() || statement.trim() === ';') continue;

      console.log(`\n📝 Executing statement ${i + 1}/${statements.length}...`);
      console.log(statement.substring(0, 80) + '...');

      const { data, error } = await supabase.rpc('exec_sql', { sql_query: statement });

      if (error) {
        // Try direct query instead
        console.log('⚠️  RPC failed, trying direct query...');
        const { error: queryError } = await supabase.from('_migrations').select().limit(1);
        
        if (queryError && queryError.message.includes('does not exist')) {
          console.log('ℹ️  Using PostgREST endpoint for SQL execution');
          // We need to use the Supabase SQL editor or management API
          console.log('');
          console.log('⚠️  Cannot execute SQL directly from Node.js');
          console.log('');
          console.log('📋 Please apply this SQL manually:');
          console.log('1. Go to: https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/editor');
          console.log('2. Paste the SQL from the migration file');
          console.log('3. Click "Run"');
          console.log('');
          console.log('Or use Supabase CLI:');
          console.log('  cd development');
          console.log('  npx supabase db push --linked');
          return;
        }
        
        throw error;
      }

      console.log('✅ Statement executed successfully');
    }

    console.log('');
    console.log('✅ Migration applied successfully!');
    console.log('');
    console.log('🧪 Test the fix:');
    console.log('1. Refresh https://demo-stage.netneural.ai/');
    console.log('2. Login with: admin@netneural.ai / Admin123!');
    console.log('3. Should see dashboard without errors');

  } catch (error) {
    console.error('');
    console.error('❌ Error applying migration:', error.message);
    console.error('');
    console.error('📋 Manual steps required:');
    console.error('1. Go to Supabase SQL Editor:');
    console.error('   https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/editor');
    console.error('2. Copy the SQL from:');
    console.error('   development/supabase/migrations/20260214000001_fix_users_rls_circular_dependency.sql');
    console.error('3. Paste and run in SQL Editor');
    process.exit(1);
  }
}

applyMigration().catch(console.error);
