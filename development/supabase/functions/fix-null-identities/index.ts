/**
 * fix-null-identities — Scheduled Edge Function
 *
 * Runs on a cron schedule (every 6 hours).
 * Scans all auth users, finds any with null/missing identity records,
 * and repairs them via the admin API by setting a random temp password
 * (which forces Supabase to create the missing identity row).
 * After repair, sends a password-reset email so the user can regain access
 * with their own credentials.
 *
 * Root cause: accounts created via the admin API (invite / bulk import)
 * never received an auth.identities row, so email+password login always
 * fails — even after a password-reset email is used.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
// Per-project app URL: set as edge function secret in each Supabase project.
//   prod:    https://sentinel.netneural.ai
//   staging: https://demo-stage.netneural.ai
//   dev:     https://demo.netneural.ai
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://sentinel.netneural.ai'

const ADMIN_HEADERS = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
}

interface AuthUser {
  id: string
  email: string
  identities: unknown[] | null
  email_confirmed_at: string | null
}

interface Page {
  users: AuthUser[]
  aud: string
}

async function fetchAllUsers(): Promise<AuthUser[]> {
  const users: AuthUser[] = []
  let page = 1
  const perPage = 1000

  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
      { headers: ADMIN_HEADERS }
    )
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Failed to list users (page ${page}): ${text}`)
    }
    const data: Page = await res.json()
    users.push(...data.users)
    if (data.users.length < perPage) break
    page++
  }

  return users
}

/**
 * IMPORTANT: The paginated admin users list endpoint (/admin/users?per_page=N)
 * always returns `identities: null` regardless of actual identity state (a
 * known Supabase API behaviour — identities are omitted for performance).
 * To reliably detect users with truly missing identity rows, we must either:
 *   (a) Fetch each user individually via GET /admin/users/:id, or
 *   (b) Query auth.identities directly via postgres.
 *
 * We use option (a): only treat a user as broken if their individual record
 * also shows no identities. This costs one extra HTTP call per user but
 * prevents mass-resetting passwords for users who are perfectly fine.
 */
async function userHasIdentity(userId: string): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    headers: ADMIN_HEADERS,
  })
  if (!res.ok) return true // assume OK on error to avoid false positives
  const user: AuthUser = await res.json()
  return Array.isArray(user.identities) && user.identities.length > 0
}

async function repairUser(user: AuthUser): Promise<boolean> {
  // Set a cryptographically random temp password — forces identity creation.
  // The user will get a reset email so they never need to know this value.
  const tempPassword = crypto.randomUUID() + crypto.randomUUID()

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
    method: 'PUT',
    headers: ADMIN_HEADERS,
    body: JSON.stringify({
      password: tempPassword,
      email_confirm: true,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`[fix-null-identities] PUT failed for ${user.email}: ${text}`)
    return false
  }

  const updated: AuthUser = await res.json()
  return Array.isArray(updated.identities) && updated.identities.length > 0
}

async function sendPasswordReset(email: string): Promise<void> {
  // Always specify the redirect so the user lands on the update-password page,
  // not the Supabase-configured site_url (which may differ per project).
  const redirectTo = `${SITE_URL}/auth/reset-password`

  const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
    method: 'POST',
    headers: ADMIN_HEADERS,
    body: JSON.stringify({ email, email_redirect_to: redirectTo }),
  })
  if (!res.ok) {
    const text = await res.text()
    // Non-fatal — log and continue
    console.warn(`[fix-null-identities] Reset email failed for ${email}: ${text}`)
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Allow manual trigger via POST as well as cron GET
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const startedAt = new Date().toISOString()
  console.log(`[fix-null-identities] Starting run at ${startedAt}`)

  try {
    const allUsers = await fetchAllUsers()
    console.log(`[fix-null-identities] Total users: ${allUsers.length}`)

    // The paginated list always returns identities:null — we must individually
    // verify each user before treating them as broken. See note above.
    const candidatesWithNullInList = allUsers.filter(
      (u) => u.identities === null || (Array.isArray(u.identities) && u.identities.length === 0)
    )

    // Verify individually — only repair those that truly have no identity
    const broken: AuthUser[] = []
    for (const user of candidatesWithNullInList) {
      const hasIdentity = await userHasIdentity(user.id)
      if (!hasIdentity) {
        broken.push(user)
      }
      // Small delay to avoid hammering the admin API
      await new Promise((r) => setTimeout(r, 50))
    }

    if (broken.length === 0) {
      console.log('[fix-null-identities] No broken identities found. All clear.')
      return new Response(
        JSON.stringify({ status: 'ok', checked: allUsers.length, fixed: 0, failed: 0, startedAt }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[fix-null-identities] Found ${broken.length} truly broken users (verified individually)`)

    const results = { fixed: [] as string[], failed: [] as string[] }

    for (const user of broken) {
      const ok = await repairUser(user)
      if (ok) {
        results.fixed.push(user.email)
        console.log(`[fix-null-identities] FIXED: ${user.email}`)
        // Send a password-reset email so the user can regain access with their
        // own credentials.  This is safe because we only reach here for users
        // whose identity was JUST created (they were in the broken list); users
        // who already have an identity are filtered out above and will never
        // receive a spurious reset email that would invalidate an in-flight token.
        await sendPasswordReset(user.email)
      } else {
        results.failed.push(user.email)
        console.error(`[fix-null-identities] FAILED: ${user.email}`)
      }
      // Small delay to avoid rate-limiting the admin API
      await new Promise((r) => setTimeout(r, 150))
    }

    const summary = {
      status: results.failed.length === 0 ? 'ok' : 'partial',
      checked: allUsers.length,
      brokenFound: broken.length,
      fixed: results.fixed.length,
      failed: results.failed.length,
      fixedAccounts: results.fixed,
      failedAccounts: results.failed,
      startedAt,
      completedAt: new Date().toISOString(),
    }

    console.log(`[fix-null-identities] Done: ${results.fixed.length} fixed, ${results.failed.length} failed`)
    return new Response(JSON.stringify(summary), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[fix-null-identities] Unhandled error: ${message}`)
    return new Response(
      JSON.stringify({ status: 'error', error: message, startedAt }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
