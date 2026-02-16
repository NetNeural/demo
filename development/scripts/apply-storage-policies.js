const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  'https://atgbmxicqikmapfqouco.supabase.co',
  process.env.STAGE_SUPABASE_SERVICE_ROLE_KEY || ''
);

async function applyStoragePolicies() {
  console.log('Applying storage policies for organization-assets bucket...\n');

  const sqlFile = path.join(__dirname, '../supabase/migrations/20260216000001_apply_storage_policies.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  // Split by statement (rough split by semicolons)
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Found ${statements.length} SQL statements to execute\n`);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (statement.includes('DROP POLICY') || statement.includes('CREATE POLICY')) {
      console.log(`Executing statement ${i + 1}...`);
      
      const { error } = await supabase.rpc('exec_sql', { sql_query: statement + ';' });
      
      if (error) {
        console.error(`Error: ${error.message}`);
      } else {
        console.log('✅ Success');
      }
    }
  }

  console.log('\n=== Verifying policies ===');
  console.log('Please check in Supabase Dashboard:');
  console.log('https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/storage/policies');
}

applyStoragePolicies().catch(console.error);
