// ===========================================================================
// Edge Function: feedback-reply
// ===========================================================================
// Handles feedback interactions:
//   POST /feedback-reply
//     action: 'comment'  — Post a comment on the GitHub issue
//     action: 'edit'     — Update the feedback + GitHub issue body
//     action: 'request-info' — Admin sends back asking for more info
//
// Both submitters and admins can comment.
// Only the original submitter can edit.
// Only admins/owners/super_admins can request-info.
// ===========================================================================

import {
  createEdgeFunction,
  createSuccessResponse,
  DatabaseError,
} from '../_shared/request-handler.ts'
import { createServiceClient } from '../_shared/auth.ts'

const GITHUB_REPO = 'NetNeural/MonoRepo-Staging'

interface ReplyRequest {
  feedbackId: string
  organizationId: string
  action: 'comment' | 'edit' | 'request-info'
  // For 'comment' and 'request-info':
  comment?: string
  // For 'edit':
  title?: string
  description?: string
  severity?: 'critical' | 'high' | 'medium' | 'low'
}

export default createEdgeFunction(
  async ({ req, userContext }) => {
    if (req.method !== 'POST') {
      throw new DatabaseError('Only POST method is supported', 405)
    }

    const user = userContext!
    const body: ReplyRequest = await req.json()
    const { feedbackId, organizationId, action } = body

    if (!feedbackId || !organizationId || !action) {
      throw new DatabaseError(
        'feedbackId, organizationId, and action are required',
        400
      )
    }

    if (!['comment', 'edit', 'request-info'].includes(action)) {
      throw new DatabaseError(
        'action must be "comment", "edit", or "request-info"',
        400
      )
    }

    const serviceClient = createServiceClient()
    const githubToken = Deno.env.get('GITHUB_TOKEN')

    // Verify org membership
    let memberRole: string | null = null
    if (user.role === 'super_admin') {
      memberRole = 'super_admin'
    } else {
      const { data: membership } = await serviceClient
        .from('organization_members')
        .select('role')
        .eq('user_id', user.userId)
        .eq('organization_id', organizationId)
        .single()

      if (!membership) {
        throw new DatabaseError(
          'You must be a member of this organization',
          403
        )
      }
      memberRole = membership.role
    }

    // Fetch the feedback item
    const { data: feedback, error: feedbackError } = await serviceClient
      .from('feedback')
      .select(
        'id, user_id, title, description, severity, status, github_issue_number, github_issue_url, organization_id'
      )
      .eq('id', feedbackId)
      .eq('organization_id', organizationId)
      .single()

    if (feedbackError || !feedback) {
      throw new DatabaseError('Feedback item not found', 404)
    }

    const isSubmitter = feedback.user_id === user.userId
    const isAdminOrAbove = ['owner', 'admin', 'super_admin'].includes(
      memberRole || ''
    )

    // ─── ACTION: comment ───────────────────────────────────────────
    if (action === 'comment') {
      const commentText = body.comment?.trim()
      if (!commentText) {
        throw new DatabaseError('Comment text is required', 400)
      }

      // Post to GitHub if linked
      if (feedback.github_issue_number && githubToken) {
        const prefix = isAdminOrAbove
          ? `**${user.email}** (admin) replied:`
          : `**${user.email}** added additional information:`

        const ghBody = `${prefix}\n\n${commentText}`

        const ghRes = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/issues/${feedback.github_issue_number}/comments`,
          {
            method: 'POST',
            headers: {
              Authorization: `token ${githubToken}`,
              Accept: 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
              'User-Agent': 'NetNeural-Feedback-Reply',
            },
            body: JSON.stringify({ body: ghBody }),
          }
        )

        if (!ghRes.ok) {
          const errText = await ghRes.text()
          console.error(`GitHub comment failed: ${ghRes.status}`, errText)
          throw new DatabaseError('Failed to post comment to GitHub', 502)
        }

        console.log(
          `[feedback-reply] Comment posted to GitHub issue #${feedback.github_issue_number}`
        )
      }

      return createSuccessResponse({
        message: 'Comment posted successfully',
        postedToGitHub: !!feedback.github_issue_number,
      })
    }

    // ─── ACTION: edit ──────────────────────────────────────────────
    if (action === 'edit') {
      // Only the original submitter can edit
      if (!isSubmitter) {
        throw new DatabaseError(
          'Only the original submitter can edit this feedback',
          403
        )
      }

      const newTitle = body.title?.trim()
      const newDescription = body.description?.trim()

      if (!newTitle && !newDescription) {
        throw new DatabaseError(
          'At least title or description must be provided',
          400
        )
      }

      // Update local DB
      const updates: Record<string, unknown> = {}
      if (newTitle) updates.title = newTitle
      if (newDescription) updates.description = newDescription
      if (body.severity && feedback.severity !== null) {
        updates.severity = body.severity
      }

      const { data: updated, error: updateError } = await serviceClient
        .from('feedback')
        .update(updates)
        .eq('id', feedbackId)
        .eq('user_id', user.userId)
        .select(
          'id, user_id, type, title, description, severity, status, github_issue_number, github_issue_url, github_resolution, created_at'
        )
        .single()

      if (updateError) {
        console.error('Feedback update failed:', updateError)
        throw new DatabaseError(
          `Failed to update feedback: ${updateError.message}`,
          500
        )
      }

      // Sync title + description to GitHub issue
      if (feedback.github_issue_number && githubToken) {
        const issueType =
          (updated as Record<string, unknown>).type === 'bug_report'
            ? '[Bug]'
            : '[Feature Request]'
        const issueTitle = `${issueType} ${newTitle || feedback.title}`

        // Build updated issue body
        const severityLine =
          (updated as Record<string, unknown>).severity
            ? `**Severity:** ${(updated as Record<string, unknown>).severity}\n`
            : ''
        const issueBody = `## User Feedback

**Type:** ${(updated as Record<string, unknown>).type === 'bug_report' ? '🐛 Bug Report' : '💡 Feature Request'}
**Submitted by:** ${user.email}
${severityLine}
---

${newDescription || feedback.description}

---

> _Updated via NetNeural in-app feedback form at ${new Date().toISOString()}_`

        const ghPatch: Record<string, string> = {}
        if (newTitle) ghPatch.title = issueTitle
        if (newDescription) ghPatch.body = issueBody

        const ghRes = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/issues/${feedback.github_issue_number}`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `token ${githubToken}`,
              Accept: 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
              'User-Agent': 'NetNeural-Feedback-Reply',
            },
            body: JSON.stringify(ghPatch),
          }
        )

        if (!ghRes.ok) {
          console.error(`GitHub issue update failed: ${ghRes.status}`)
          // Non-fatal — local DB was updated
        } else {
          console.log(
            `[feedback-reply] Updated GitHub issue #${feedback.github_issue_number}`
          )
        }
      }

      return createSuccessResponse({
        feedback: updated,
        message: 'Feedback updated successfully',
        syncedToGitHub: !!feedback.github_issue_number,
      })
    }

    // ─── ACTION: request-info ──────────────────────────────────────
    if (action === 'request-info') {
      if (!isAdminOrAbove) {
        throw new DatabaseError(
          'Only admins and owners can request additional information',
          403
        )
      }

      const commentText = body.comment?.trim()
      if (!commentText) {
        throw new DatabaseError('Message to the user is required', 400)
      }

      // Update status to 'needs_info'
      await serviceClient
        .from('feedback')
        .update({ status: 'needs_info' })
        .eq('id', feedbackId)

      // Post to GitHub
      if (feedback.github_issue_number && githubToken) {
        const ghBody = `### 📋 Additional Information Requested

**From:** ${user.email} (${memberRole})

${commentText}

---
_Status changed to **Needs Info** — awaiting response from submitter._`

        await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/issues/${feedback.github_issue_number}/comments`,
          {
            method: 'POST',
            headers: {
              Authorization: `token ${githubToken}`,
              Accept: 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
              'User-Agent': 'NetNeural-Feedback-Reply',
            },
            body: JSON.stringify({ body: ghBody }),
          }
        )

        // Add 'needs-info' label
        await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/issues/${feedback.github_issue_number}/labels`,
          {
            method: 'POST',
            headers: {
              Authorization: `token ${githubToken}`,
              Accept: 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
              'User-Agent': 'NetNeural-Feedback-Reply',
            },
            body: JSON.stringify({ labels: ['needs-info'] }),
          }
        )
      }

      return createSuccessResponse({
        message: 'Information request sent',
        status: 'needs_info',
      })
    }

    throw new DatabaseError('Unknown action', 400)
  },
  {
    requireAuth: true,
    allowedMethods: ['POST', 'OPTIONS'],
    logActivity: true,
  }
)
