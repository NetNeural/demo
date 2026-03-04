// ===========================================================================
// Edge Function: reseller-agreement-review
// ===========================================================================
// Called by super admins to approve or reject a reseller agreement application.
//
// POST /reseller-agreement-review
// Body: { applicationId, action: 'approve'|'reject', revenueShare?, maxChildOrgs?, reviewNotes? }
//
// On approve:
//   1. Update application status → approved
//   2. Insert active reseller_agreement record
//   3. Promote org (is_reseller = true)
//   4. Comment + close GitHub issue (if linked)
//   5. Send approval email to applicant
//
// On reject:
//   1. Update application status → rejected
//   2. Comment + close GitHub issue (if linked)
//   3. Send rejection email to applicant
// ===========================================================================

import {
  createEdgeFunction,
  createSuccessResponse,
  createErrorResponse,
  DatabaseError,
} from '../_shared/request-handler.ts'
import { createServiceClient } from '../_shared/auth.ts'

interface ReviewRequest {
  applicationId: string
  action: 'approve' | 'reject'
  revenueShare?: number
  maxChildOrgs?: number
  reviewNotes?: string
}

const GITHUB_REPO = 'NetNeural/MonoRepo-Staging'

async function closeGitHubIssue(
  issueNumber: number,
  comment: string,
  token: string
) {
  const base = `https://api.github.com/repos/${GITHUB_REPO}/issues/${issueNumber}`
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  // Post comment first
  await fetch(`${base}/comments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ body: comment }),
  })
  // Close the issue
  await fetch(base, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ state: 'closed', state_reason: 'completed' }),
  })
}

async function sendEmail(
  supabaseUrl: string,
  serviceRoleKey: string,
  to: string,
  subject: string,
  html: string
) {
  await fetch(`${supabaseUrl}/functions/v1/send-email`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to: [to], subject, html }),
  })
}

export default createEdgeFunction(
  async ({ req, userContext }) => {
    const user = userContext!

    if (!user.isPlatformAdmin) {
      throw new DatabaseError('Platform admin access required', 403)
    }

    if (req.method !== 'POST') {
      return createErrorResponse('Only POST is supported', 405)
    }

    const body = (await req.json()) as ReviewRequest
    const { applicationId, action, revenueShare = 20, maxChildOrgs = 10, reviewNotes } = body

    if (!applicationId || !['approve', 'reject'].includes(action)) {
      throw new DatabaseError('applicationId and action (approve|reject) are required', 400)
    }

    const serviceClient = createServiceClient()
    const githubToken = Deno.env.get('GITHUB_TOKEN')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Load application
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: app, error: appLoadErr } = await (serviceClient as any)
      .from('reseller_agreement_applications')
      .select('*, organization:organizations(name, slug)')
      .eq('id', applicationId)
      .single()

    if (appLoadErr || !app) {
      throw new DatabaseError('Application not found', 404)
    }

    const now = new Date().toISOString()
    const today = now.split('T')[0]

    if (action === 'approve') {
      // 1. Update application
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateErr } = await (serviceClient as any)
        .from('reseller_agreement_applications')
        .update({ status: 'approved', reviewed_at: now, reviewed_by: user.userId })
        .eq('id', applicationId)
      if (updateErr) throw new DatabaseError(updateErr.message, 500)

      // 2. Create reseller agreement
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: agrErr } = await (serviceClient as any)
        .from('reseller_agreements')
        .insert({
          organization_id: app.organization_id,
          status: 'active',
          agreement_type: 'standard',
          agreement_version: '1.0',
          effective_date: today,
          revenue_share_percent: revenueShare,
          max_child_organizations: maxChildOrgs,
          billing_model: app.preferred_billing || 'invoice',
          accepted_at: now,
          accepted_by: user.userId,
        })
      if (agrErr) throw new DatabaseError(agrErr.message, 500)

      // 3. Promote org to reseller
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: orgErr } = await (serviceClient as any)
        .from('organizations')
        .update({ is_reseller: true })
        .eq('id', app.organization_id)
      if (orgErr) throw new DatabaseError(orgErr.message, 500)

      // 4. Close GitHub issue
      if (app.github_issue_number && githubToken) {
        const comment = `## ✅ Application Approved

This reseller application has been **approved** by the NetNeural team.

**Agreement Terms:**
- Revenue Share: ${revenueShare}%
- Max Child Organizations: ${maxChildOrgs}
- Billing Model: ${app.preferred_billing || 'invoice'}
- Effective Date: ${today}

The organization \`${app.organization?.slug || app.organization_id}\` has been promoted to reseller status. A welcome email has been sent to ${app.applicant_email}.`

        try {
          await closeGitHubIssue(app.github_issue_number, comment, githubToken)
        } catch (ghErr) {
          console.error('GitHub close failed (non-fatal):', ghErr)
        }
      }

      // 5. Send approval email
      const approvalHtml = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #111;">
  <div style="background: #16a34a; color: white; padding: 24px 32px; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 22px;">🎉 Reseller Application Approved</h1>
  </div>
  <div style="border: 1px solid #e5e7eb; border-top: none; padding: 32px; border-radius: 0 0 8px 8px;">
    <p>Dear ${app.applicant_name},</p>
    <p>We're excited to let you know that your reseller agreement application for <strong>${app.company_legal_name}</strong> has been <strong>approved</strong>.</p>
    <h3 style="color: #16a34a;">Agreement Summary</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tr><td style="padding: 6px 12px; background: #f9fafb; font-weight: 600;">Revenue Share</td><td style="padding: 6px 12px;">${revenueShare}%</td></tr>
      <tr><td style="padding: 6px 12px; font-weight: 600;">Max Child Organizations</td><td style="padding: 6px 12px;">${maxChildOrgs}</td></tr>
      <tr><td style="padding: 6px 12px; background: #f9fafb; font-weight: 600;">Billing Model</td><td style="padding: 6px 12px;">${app.preferred_billing || 'Invoice'}</td></tr>
      <tr><td style="padding: 6px 12px; font-weight: 600;">Effective Date</td><td style="padding: 6px 12px;">${today}</td></tr>
    </table>
    <p style="margin-top: 24px;">Your account has been upgraded to reseller status. You can now create child organizations and access the Reseller Dashboard from your account.</p>
    <p>If you have any questions, please don't hesitate to reach out to our team.</p>
    <p style="color: #6b7280; font-size: 13px; margin-top: 32px;">Best regards,<br/>The NetNeural Team</p>
  </div>
</body>
</html>`

      try {
        await sendEmail(supabaseUrl, serviceRoleKey, app.applicant_email, 'Your NetNeural Reseller Application has been Approved ✅', approvalHtml)
      } catch (emailErr) {
        console.error('Approval email failed (non-fatal):', emailErr)
      }

    } else {
      // REJECT

      // 1. Update application
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateErr } = await (serviceClient as any)
        .from('reseller_agreement_applications')
        .update({
          status: 'rejected',
          reviewed_at: now,
          reviewed_by: user.userId,
          review_notes: reviewNotes?.trim() || null,
        })
        .eq('id', applicationId)
      if (updateErr) throw new DatabaseError(updateErr.message, 500)

      // 2. Close GitHub issue
      if (app.github_issue_number && githubToken) {
        const commentLines = [`## ❌ Application Rejected\n\nThis reseller application has been **rejected** by the NetNeural team.`]
        if (reviewNotes?.trim()) {
          commentLines.push(`\n**Review Notes:**\n${reviewNotes.trim()}`)
        }
        commentLines.push(`\nThe applicant (${app.applicant_email}) has been notified via email.`)

        try {
          await closeGitHubIssue(app.github_issue_number, commentLines.join('\n'), githubToken)
        } catch (ghErr) {
          console.error('GitHub close failed (non-fatal):', ghErr)
        }
      }

      // 3. Send rejection email
      const rejectionHtml = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #111;">
  <div style="background: #374151; color: white; padding: 24px 32px; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 22px;">Reseller Application Update</h1>
  </div>
  <div style="border: 1px solid #e5e7eb; border-top: none; padding: 32px; border-radius: 0 0 8px 8px;">
    <p>Dear ${app.applicant_name},</p>
    <p>Thank you for your interest in becoming a NetNeural reseller. After reviewing your application for <strong>${app.company_legal_name}</strong>, we are unable to approve it at this time.</p>
    ${reviewNotes?.trim() ? `<div style="background: #f9fafb; border-left: 4px solid #9ca3af; padding: 12px 16px; margin: 20px 0; border-radius: 4px;"><p style="margin: 0; font-size: 14px;"><strong>Review Notes:</strong><br/>${reviewNotes.trim()}</p></div>` : ''}
    <p>If you believe this decision was made in error or your circumstances have changed, you are welcome to submit a new application through the platform.</p>
    <p>We appreciate your interest in partnering with NetNeural.</p>
    <p style="color: #6b7280; font-size: 13px; margin-top: 32px;">Best regards,<br/>The NetNeural Team</p>
  </div>
</body>
</html>`

      try {
        await sendEmail(supabaseUrl, serviceRoleKey, app.applicant_email, 'Update on Your NetNeural Reseller Application', rejectionHtml)
      } catch (emailErr) {
        console.error('Rejection email failed (non-fatal):', emailErr)
      }
    }

    return createSuccessResponse({
      success: true,
      action,
      applicationId,
      message: action === 'approve'
        ? `Application approved. Agreement created, org promoted, GitHub issue closed, email sent.`
        : `Application rejected. GitHub issue closed, email sent.`,
    })
  },
  { requireAuth: true }
)
