import {
  createEdgeFunction,
  createSuccessResponse,
  DatabaseError,
} from '../_shared/request-handler.ts'
import { createClient } from '@supabase/supabase-js'

const REMINDER_INTERVAL_DAYS = 5
const EXPIRY_DAYS = 20
const MS_PER_DAY = 1000 * 60 * 60 * 24

type DenoEnvGetter = {
  Deno?: {
    env?: {
      get?: (key: string) => string | undefined
    }
  }
}

interface LifecycleUser {
  id: string
  email: string
  full_name: string | null
  created_at: string
  inactive_reminder_last_sent_at: string | null
}

function getDaysSince(timestamp: string, now: Date): number {
  const then = new Date(timestamp)
  return Math.floor((now.getTime() - then.getTime()) / MS_PER_DAY)
}

async function sendInactivityReminderEmail(
  resendApiKey: string,
  user: LifecycleUser,
  remainingDays: number
) {
  const subject = `Action required: Activate your NetNeural account (${remainingDays} day${remainingDays === 1 ? '' : 's'} remaining)`

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'NetNeural Platform <noreply@netneural.ai>',
      to: user.email,
      subject,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #1a1a1a; color: #fff; padding: 20px; text-align: center; }
              .content { background: #f9f9f9; padding: 24px; margin-top: 16px; border-radius: 6px; }
              .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 16px 0; }
              .button { display: inline-block; background: #1a1a1a; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 4px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>NetNeural Account Reminder</h1>
              </div>
              <div class="content">
                <p>Hello ${user.full_name || 'there'},</p>
                <p>Your NetNeural account has not been activated yet. Please sign in to keep your access active.</p>
                <div class="warning">
                  <strong>${remainingDays} day${remainingDays === 1 ? '' : 's'} remaining</strong> before this account is disabled and removed.
                </div>
                <p style="text-align:center; margin-top: 20px;">
                  <a href="https://demo-stage.netneural.ai/auth/login" class="button">Activate Account</a>
                </p>
                <p>If you need help, contact your administrator.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    }),
  })

  if (!response.ok) {
    const errorPayload = await response.text()
    throw new Error(`Resend failed (${response.status}): ${errorPayload}`)
  }
}

export default createEdgeFunction(
  async ({ req }) => {
    const denoGlobal = globalThis as unknown as DenoEnvGetter
    const envGet = denoGlobal.Deno?.env?.get

    const supabaseUrl = envGet?.('SUPABASE_URL')
    const serviceRoleKey = envGet?.('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for this function'
      )
    }

    const authHeader = req.headers.get('Authorization')
    if (authHeader !== `Bearer ${serviceRoleKey}`) {
      throw new DatabaseError('Unauthorized lifecycle cron invocation', 401)
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const now = new Date()
    const resendApiKey = envGet?.('RESEND_API_KEY')

    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select(
        'id, email, full_name, created_at, inactive_reminder_last_sent_at, is_active, last_login, password_change_required'
      )
      .eq('is_active', true)
      .or('last_login.is.null,password_change_required.eq.true')

    if (usersError) {
      throw usersError
    }

    const candidates = (users || []) as Array<
      LifecycleUser & {
        is_active: boolean
        last_login: string | null
        password_change_required: boolean | null
      }
    >

    let remindersSent = 0
    let disabledCount = 0
    let deletedCount = 0
    let skippedCount = 0
    const errors: string[] = []

    for (const user of candidates) {
      try {
        const daysSinceCreated = getDaysSince(user.created_at, now)

        if (daysSinceCreated >= EXPIRY_DAYS) {
          const { error: disableError } = await supabaseAdmin
            .from('users')
            .update({ is_active: false })
            .eq('id', user.id)

          if (disableError) {
            throw new Error(`Disable failed for ${user.email}: ${disableError.message}`)
          }

          disabledCount += 1

          const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
            user.id
          )

          if (deleteError) {
            throw new Error(`Delete failed for ${user.email}: ${deleteError.message}`)
          }

          deletedCount += 1
          continue
        }

        if (daysSinceCreated < REMINDER_INTERVAL_DAYS) {
          skippedCount += 1
          continue
        }

        const lastReminderDaysAgo = user.inactive_reminder_last_sent_at
          ? getDaysSince(user.inactive_reminder_last_sent_at, now)
          : Number.POSITIVE_INFINITY

        if (lastReminderDaysAgo < REMINDER_INTERVAL_DAYS) {
          skippedCount += 1
          continue
        }

        if (!resendApiKey) {
          errors.push(`Missing RESEND_API_KEY - reminder not sent to ${user.email}`)
          continue
        }

        const remainingDays = Math.max(EXPIRY_DAYS - daysSinceCreated, 0)

        await sendInactivityReminderEmail(resendApiKey, user, remainingDays)

        const { error: reminderUpdateError } = await supabaseAdmin
          .from('users')
          .update({ inactive_reminder_last_sent_at: now.toISOString() })
          .eq('id', user.id)

        if (reminderUpdateError) {
          throw new Error(
            `Reminder timestamp update failed for ${user.email}: ${reminderUpdateError.message}`
          )
        }

        remindersSent += 1
      } catch (error) {
        const message =
          error instanceof Error ? error.message : `Unknown error for user ${user.email}`
        errors.push(message)
      }
    }

    return createSuccessResponse({
      processed: candidates.length,
      remindersSent,
      disabled: disabledCount,
      deleted: deletedCount,
      skipped: skippedCount,
      errors,
      schedule: {
        reminderEveryDays: REMINDER_INTERVAL_DAYS,
        expiryDays: EXPIRY_DAYS,
      },
    })
  },
  {
    requireAuth: false,
    allowedMethods: ['POST'],
  }
)
