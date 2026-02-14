#!/usr/bin/env node

/**
 * Apply migration by executing SQL statements
 */

const { createClient } = require('@supabase/supabase-js');

const STAGING_URL = 'https://atgbmxicqikmapfqouco.supabase.co';
const STAGING_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0Z2JteGljcWlrbWFwZnFvdWNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTAxNzgwOSwiZXhwIjoyMDg2NTkzODA5fQ.tGj8TfFUR3DiXWEYT1Lt41zvzxb5HipUnpfF-QfHbjY';

const supabase = createClient(STAGING_URL, STAGING_SERVICE_ROLE_KEY, {
  db: { schema: 'public' },
  auth: { persistSession: false }
});

async function applyFix() {
  console.log('🔧 Fixing organization_members RLS policy...\n');

  try {
    // Method 1: Use Supabase REST API to execute SQL
    const response = await fetch(`${STAGING_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': STAGING_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${STAGING_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        query: `
-- Drop the overly restrictive policy
DROP POLICY IF EXISTS "Users view own memberships only" ON organization_members;

-- Create new policy: Users can view all members of organizations they belong to
CREATE POLICY "Users can view members in their organizations" ON organization_members
    FOR SELECT 
    USING (
        -- Service role has full access
        auth.jwt() ->> 'role' = 'service_role'
        OR
        -- Super admins can see all
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'super_admin'
        )
        OR
        -- Regular users can see members of their own organizations
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om
            WHERE om.user_id = auth.uid()
        )
    );
        `
      })
    });

    if (!response.ok) {
      console.log('❌ exec_sql RPC not available');
      console.log('📝 Please apply this migration manually in Supabase SQL Editor:');
      console.log('   https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/sql/new\n');
      console.log('SQL to execute:');
      console.log('--- COPY BELOW ---');
      console.log(`
DROP POLICY IF EXISTS "Users view own memberships only" ON organization_members;

CREATE POLICY "Users can view members in their organizations" ON organization_members
    FOR SELECT 
    USING (
        auth.jwt() ->> 'role' = 'service_role'
        OR
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'super_admin'
        )
        OR
        organization_id IN (
            SELECT om.organization_id 
            FROM organization_members om
            WHERE om.user_id = auth.uid()
        )
    );
      `);
      console.log('--- COPY ABOVE ---');
      return;
    }

    console.log('✅ Migration applied successfully!\n');

    // Test the fix
    console.log('🧪 Testing member count...');
    const { count, error } = await supabase
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', '00000000-0000-0000-0000-000000000001');

    if (error) {
      console.error('❌ Test failed:', error.message);
    } else {
      console.log(`✅ Success! Can now see ${count} members`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

applyFix().catch(console.error);
