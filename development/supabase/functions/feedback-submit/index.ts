// ===========================================================================
// Edge Function: feedback-submit
// ===========================================================================
// Handles user feedback submission:
//   1. Validates the submission
//   2. Creates a GitHub Issue via the GitHub API
//   3. Stores the feedback in the feedback table
//   4. Returns the created issue URL
//
// Issue #41: In-app feedback for bug reports and feature requests
// ===========================================================================

import {
  createEdgeFunction,
  createSuccessResponse,
  createErrorResponse,
  DatabaseError,
} from '../_shared/request-handler.ts'
import { createServiceClient } from '../_shared/auth.ts'

interface FeedbackRequest {
  organizationId: string
  type: 'bug_report' | 'feature_request'
  title: string
  description: string
  severity?: 'critical' | 'high' | 'medium' | 'low'
  bugOccurredDate?: string
  bugOccurredTime?: string
  bugTimezone?: string
  browserInfo?: string
  pageUrl?: string
}

export default createEdgeFunction(
  async ({ req, userContext }) => {
    if (req.method !== 'POST') {
      return createErrorResponse('Only POST method is supported', 405)
    }

    const user = userContext!
    const body: FeedbackRequest = await req.json()
    const {
      organizationId,
      type,
      title,
      description,
      severity,
      bugOccurredDate,
      bugOccurredTime,
      bugTimezone,
      browserInfo,
      pageUrl,
    } = body

    // Validate required fields
    if (!organizationId)
      throw new DatabaseError('organizationId is required', 400)
    if (!type || !['bug_report', 'feature_request'].includes(type)) {
      throw new DatabaseError(
        'type must be "bug_report" or "feature_request"',
        400
      )
    }
    if (!title || title.trim().length === 0)
      throw new DatabaseError('title is required', 400)
    if (!description || description.trim().length === 0)
      throw new DatabaseError('description is required', 400)

    const serviceClient = createServiceClient()

    // ---------------------------------------------------------------
    // Duplicate prevention: reject if same user submitted feedback
    // with the same title in the last 5 minutes
    // ---------------------------------------------------------------
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data: recentDupe } = await serviceClient
      .from('feedback')
      .select('id')
      .eq('user_id', user.userId)
      .eq('organization_id', organizationId)
      .eq('title', title.trim())
      .gte('created_at', fiveMinutesAgo)
      .limit(1)
      .maybeSingle()

    if (recentDupe) {
      console.log(
        `[feedback-submit] Duplicate blocked: user ${user.userId} already submitted "${title}" recently (id=${recentDupe.id})`
      )
      // Return success (not an error) so the UI doesn't keep retrying
      return createSuccessResponse({
        feedback: recentDupe,
        message: 'This feedback was already submitted recently.',
        duplicate: true,
      })
    }

    // Super admins have global organization access (virtual membership)
    if (user.role !== 'super_admin') {
      const { data: membership, error: memberError } = await serviceClient
        .from('organization_members')
        .select('role')
        .eq('user_id', user.userId)
        .eq('organization_id', organizationId)
        .single()

      if (memberError || !membership) {
        throw new DatabaseError(
          'You must be a member of this organization',
          403
        )
      }
    }

    // Get organization details for labeling
    const { data: org } = await serviceClient
      .from('organizations')
      .select('name, slug')
      .eq('id', organizationId)
      .single()

    const orgLabel = org?.slug || org?.name || 'unknown-org'

    // Build GitHub issue
    const issueTitle =
      type === 'bug_report' ? `[Bug] ${title}` : `[Feature Request] ${title}`

    const severityLine = severity ? `**Severity:** ${severity}\n` : ''
    const bugObservedLine =
      type === 'bug_report' && bugOccurredDate && bugOccurredTime
        ? `**Bug observed at:** ${bugOccurredDate} ${bugOccurredTime}${bugTimezone ? ` (${bugTimezone})` : ''}\n`
        : ''
    const bugTimezoneLine =
      type === 'bug_report' && !bugObservedLine && bugTimezone
        ? `**Bug time zone:** ${bugTimezone}\n`
        : ''
    const issueBody = `## User Feedback

**Type:** ${type === 'bug_report' ? '🐛 Bug Report' : '💡 Feature Request'}
**Organization:** ${org?.name || organizationId}
**Submitted by:** ${user.email}
${severityLine}
${bugObservedLine}${bugTimezoneLine}
---

${description}

---

<details>
<summary>Submitter Context</summary>

- **Page URL:** ${pageUrl || 'N/A'}
- **Browser:** ${browserInfo || 'N/A'}
- **Timestamp:** ${new Date().toISOString()}
- **User ID:** ${user.userId}
- **Org ID:** ${organizationId}
</details>

> _This issue was automatically created from the NetNeural in-app feedback form._`

    // Build labels
    const labels: string[] = ['user-feedback']
    if (type === 'bug_report') {
      labels.push('bug')
    } else {
      labels.push('enhancement')
    }
    if (severity) {
      labels.push(`severity:${severity}`)
    }
    labels.push(`org:${orgLabel}`)

    // Create GitHub Issue
    let githubIssueNumber: number | null = null
    let githubIssueUrl: string | null = null

    const githubToken = Deno.env.get('GITHUB_TOKEN')
    if (githubToken) {
      try {
        const ghResponse = await fetch(
          'https://api.github.com/repos/NetNeural/MonoRepo-Staging/issues',
          {
            method: 'POST',
            headers: {
              Authorization: `token ${githubToken}`,
              Accept: 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
              'User-Agent': 'NetNeural-Feedback-Bot',
            },
            body: JSON.stringify({
              title: issueTitle,
              body: issueBody,
              labels,
            }),
          }
        )

        if (ghResponse.ok) {
          const ghData = await ghResponse.json()
          githubIssueNumber = ghData.number
          githubIssueUrl = ghData.html_url
          console.log(`GitHub issue created: #${githubIssueNumber}`)
        } else {
          const errorText = await ghResponse.text()
          console.error(`GitHub API error (${ghResponse.status}):`, errorText)
        }
      } catch (ghError) {
        console.error('GitHub API call failed:', ghError)
        // Non-fatal: still save feedback locally
      }
    } else {
      console.warn(
        'GITHUB_TOKEN not configured — skipping GitHub issue creation'
      )
    }

    // Store feedback in database
    const { data: feedback, error: insertError } = await serviceClient
      .from('feedback')
      .insert({
        organization_id: organizationId,
        user_id: user.userId,
        type,
        title: title.trim(),
        description: description.trim(),
        severity: severity || null,
        bug_occurred_date: bugOccurredDate || null,
        bug_occurred_time: bugOccurredTime || null,
        bug_timezone: bugTimezone || null,
        github_issue_number: githubIssueNumber,
        github_issue_url: githubIssueUrl,
        browser_info: browserInfo || null,
        page_url: pageUrl || null,
        status: 'submitted',
      })
      .select('id, github_issue_number, github_issue_url, status, created_at')
      .single()

    if (insertError) {
      console.error('Feedback insert failed:', insertError)
      throw new DatabaseError(
        `Failed to save feedback: ${insertError.message}`,
        500
      )
    }

    return createSuccessResponse({
      feedback,
      message: githubIssueUrl
        ? `Feedback submitted and GitHub issue created (#${githubIssueNumber})`
        : 'Feedback submitted successfully',
    })
  },
  {
    requireAuth: true,
    allowedMethods: ['POST', 'OPTIONS'],
    logActivity: true,
  }
)
