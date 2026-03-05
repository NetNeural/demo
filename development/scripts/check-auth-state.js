const { Client } = require('pg');

async function main() {
  const projectRef = process.argv[2] || 'atgbmxicqikmapfqouco';
  const dbPassword = process.argv[3] || process.env.STAGING_DB_PASSWORD || '';
  
  if (!dbPassword) {
    console.error('Usage: node check-auth-state.js <project-ref> <db-password>');
    console.error('  project-ref: atgbmxicqikmapfqouco (staging) or bldojxpockljyivldxwf (prod)');
    process.exit(1);
  }

  const client = new Client({
    host: 'aws-0-us-west-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: `postgres.${projectRef}`,
    password: dbPassword,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log(`Connected to project ${projectRef}\n`);

    // 1. Check matthew's public.users record
    const userRes = await client.query(
      `SELECT id, email, role, is_active, password_change_required, 
              failed_login_attempts, locked_until, created_at, updated_at
       FROM public.users WHERE email = 'matthew.scholle@netneural.ai'`
    );
    console.log('=== PUBLIC.USERS (matthew.scholle@netneural.ai) ===');
    console.log(JSON.stringify(userRes.rows, null, 2));

    // 2. Check auth.users record
    const authRes = await client.query(
      `SELECT id, email, email_confirmed_at, banned_until, 
              confirmation_sent_at, confirmed_at, recovery_sent_at,
              last_sign_in_at, created_at, updated_at,
              is_sso_user, deleted_at,
              (encrypted_password IS NOT NULL AND encrypted_password != '') as has_password,
              COALESCE(raw_app_meta_data->>'provider', 'unknown') as provider,
              COALESCE(raw_user_meta_data->>'full_name', '') as full_name
       FROM auth.users WHERE email = 'matthew.scholle@netneural.ai'`
    );
    console.log('\n=== AUTH.USERS (matthew.scholle@netneural.ai) ===');
    console.log(JSON.stringify(authRes.rows, null, 2));

    // 3. Check MFA factors
    const mfaRes = await client.query(
      `SELECT f.id, f.factor_type, f.status, f.created_at, f.updated_at
       FROM auth.mfa_factors f
       JOIN auth.users u ON u.id = f.user_id
       WHERE u.email = 'matthew.scholle@netneural.ai'`
    );
    console.log('\n=== MFA FACTORS ===');
    console.log(JSON.stringify(mfaRes.rows, null, 2));

    // 4. Check recent sessions for matthew
    const sessRes = await client.query(
      `SELECT s.id, s.created_at, s.updated_at, s.not_after, s.refreshed_at, s.tag
       FROM auth.sessions s 
       JOIN auth.users u ON u.id = s.user_id 
       WHERE u.email = 'matthew.scholle@netneural.ai' 
       ORDER BY s.created_at DESC LIMIT 5`
    );
    console.log('\n=== RECENT SESSIONS ===');
    console.log(JSON.stringify(sessRes.rows, null, 2));

    // 5. Overall auth stats
    const statsRes = await client.query(
      `SELECT 
        (SELECT count(*) FROM auth.users WHERE deleted_at IS NULL) as total_auth_users,
        (SELECT count(*) FROM auth.users WHERE last_sign_in_at > now() - interval '24 hours') as signed_in_24h,
        (SELECT count(*) FROM auth.users WHERE last_sign_in_at > now() - interval '7 days') as signed_in_7d,
        (SELECT count(*) FROM auth.users WHERE banned_until IS NOT NULL AND banned_until > now()) as currently_banned,
        (SELECT count(*) FROM auth.users WHERE email_confirmed_at IS NULL AND deleted_at IS NULL) as unconfirmed_email,
        (SELECT count(*) FROM public.users WHERE is_active = false) as inactive_users,
        (SELECT count(*) FROM public.users WHERE locked_until IS NOT NULL AND locked_until > now()) as locked_users,
        (SELECT count(*) FROM public.users WHERE password_change_required = true) as pwd_change_required`
    );
    console.log('\n=== AUTH STATS ===');
    console.log(JSON.stringify(statsRes.rows[0], null, 2));

    // 6. Check RLS policies on public.users
    const rlsRes = await client.query(
      `SELECT policyname, permissive, roles, cmd, 
              substring(qual from 1 for 200) as qual_preview
       FROM pg_policies 
       WHERE tablename = 'users' AND schemaname = 'public'
       ORDER BY policyname`
    );
    console.log('\n=== RLS POLICIES ON PUBLIC.USERS ===');
    rlsRes.rows.forEach(r => {
      console.log(`${r.policyname} | ${r.cmd} | ${r.permissive} | roles: ${r.roles}`);
      if (r.qual_preview) console.log(`  USING: ${r.qual_preview}`);
    });

    // 7. Check identities for matthew (null identities = can't log in)
    const identRes = await client.query(
      `SELECT i.id, i.provider, i.identity_data->>'email' as identity_email,
              i.created_at, i.updated_at, i.last_sign_in_at
       FROM auth.identities i 
       JOIN auth.users u ON u.id = i.user_id
       WHERE u.email = 'matthew.scholle@netneural.ai'`
    );
    console.log('\n=== AUTH IDENTITIES ===');
    console.log(JSON.stringify(identRes.rows, null, 2));

    // 8. Check ALL users with null identities (this has been a past issue)
    const nullIdentRes = await client.query(
      `SELECT u.email, u.created_at, u.last_sign_in_at
       FROM auth.users u
       LEFT JOIN auth.identities i ON i.user_id = u.id
       WHERE i.id IS NULL AND u.deleted_at IS NULL
       ORDER BY u.email`
    );
    console.log('\n=== USERS WITH NULL IDENTITIES (cannot login!) ===');
    console.log(JSON.stringify(nullIdentRes.rows, null, 2));

    // 9. Check mailer_autoconfirm setting
    const configRes = await client.query(
      `SELECT key, value FROM auth.schema_migrations ORDER BY version DESC LIMIT 1`
    ).catch(() => null);
    
    // 10. Check GoTrue config table if exists
    const gotrueRes = await client.query(
      `SELECT * FROM auth.config LIMIT 1`
    ).catch(() => ({ rows: [] }));
    if (gotrueRes.rows.length > 0) {
      console.log('\n=== AUTH CONFIG ===');
      console.log(JSON.stringify(gotrueRes.rows[0], null, 2));
    }

  } catch(err) {
    console.error('Connection Error:', err.message);
  } finally {
    await client.end();
  }
}

main();
