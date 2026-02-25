// ===========================================================================
// Edge Function: feedback-sync
// ===========================================================================
// Syncs GitHub issue status back to the feedback table.
// For each feedback entry with a github_issue_number:
//   1. Fetches the issue state from GitHub API
//   2. If closed → updates status to 'resolved' (or 'closed')
//   3. Stores the closing comment (state_reason + last comment) as resolution
//
// Can be called:
//   - By user clicking "Sync Status" on the Feedback page
//   - By a Supabase cron job (future)
//
// Query params:
//   - organization_id (required): scope sync to one org
// ===========================================================================

import {
  createEdgeFunction,
  createSuccessResponse,
  createErrorResponse,
  DatabaseError,
} from '../_shared/request-handler.ts'
import { createServiceClient } from '../_shared/auth.ts'

const GITHUB_REPO = 'NetNeural/MonoRepo-Staging'

/** Map GitHub issue state + state_reason to feedback status */
function mapGitHubState(
  ghState: string,
  stateReason: string | null
): 'resolved' | 'closed' | null {
  if (ghState === 'closed') {
    // GitHub "completed" = resolved, "not_planned" = closed
    return stateReason === 'not_planned' ? 'closed' : 'resolved'
  }
  return null // still open → no change
}

export default createEdgeFunction(
  async ({ req, userContext }) => {
    if (req.method !== 'POST') {
      return createErrorResponse('Only POST method is supported', 405)
    }

    const user = userContext!
    const body = await req.json()
    const { organizationId } = body

    if (!organizationId) {
      throw new DatabaseError('organizationId is required', 400)
    }

    const githubToken = Deno.env.get('GITHUB_TOKEN')
    if (!githubToken) {
      throw new DatabaseError('GitHub integration not configured', 503)
    }

    const serviceClient = createServiceClient()

    // Super admins have global organization access (virtual membership)
    if (user.role !== 'super_admin') {
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
    }

    // Get all feedback entries that have a linked GitHub issue and aren't already resolved/closed
    const { data: feedbackItems, error: fetchError } = await serviceClient
      .from('feedback')
      .select('id, github_issue_number, status')
      .eq('organization_id', organizationId)
      .not('github_issue_number', 'is', null)
      .not('status', 'in', '("resolved","closed")')

    if (fetchError) {
      console.error('Failed to fetch feedback:', fetchError)
      throw new DatabaseError('Failed to fetch feedback entries', 500)
    }

    if (!feedbackItems || feedbackItems.length === 0) {
      return createSuccessResponse({
        synced: 0,
        message: 'No open feedback items with linked GitHub issues',
      })
    }

    console.log(
      `Syncing ${feedbackItems.length} feedback items for org ${organizationId}`
    )

    let synced = 0
    const results: Array<{
      id: string
      issueNumber: number
      newStatus: string
    }> = []

    for (const item of feedbackItems) {
      try {
        // Fetch GitHub issue state
        const issueResponse = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/issues/${item.github_issue_number}`,
          {
            headers: {
              Authorization: `token ${githubToken}`,
              Accept: 'application/vnd.github.v3+json',
              'User-Agent': 'NetNeural-Feedback-Sync',
            },
          }
        )

        if (!issueResponse.ok) {
          console.error(
            `GitHub API error for issue #${item.github_issue_number}: ${issueResponse.status}`
          )
          continue
        }

        const issueData = await issueResponse.json()
        const newStatus = mapGitHubState(
          issueData.state,
          issueData.state_reason || null
        )

        if (!newStatus) {
          // Still open — check if any labels map to status changes
          const labels = (issueData.labels || []).map((l: { name: string }) =>
            l.name.toLowerCase()
          )
          let labelStatus: string | null = null
          if (labels.includes('acknowledged') || labels.includes('triaged')) {
            labelStatus = 'acknowledged'
          } else if (
            labels.includes('in-progress') ||
            labels.includes('in_progress') ||
            labels.includes('wip')
          ) {
            labelStatus = 'in_progress'
          }

          if (labelStatus && labelStatus !== item.status) {
            const { error: updateError } = await serviceClient
              .from('feedback')
              .update({
                status: labelStatus,
                updated_at: new Date().toISOString(),
              })
              .eq('id', item.id)

            if (!updateError) {
              synced++
              results.push({
                id: item.id,
                issueNumber: item.github_issue_number,
                newStatus: labelStatus,
              })
            }
          }
          continue
        }

        // Issue is closed — fetch the latest comment for resolution context
        let resolution: string | null = null
        try {
          const commentsResponse = await fetch(
            `https://api.github.com/repos/${GITHUB_REPO}/issues/${item.github_issue_number}/comments?per_page=5&sort=created&direction=desc`,
            {
              headers: {
                Authorization: `token ${githubToken}`,
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'NetNeural-Feedback-Sync',
              },
            }
          )

          if (commentsResponse.ok) {
            const comments = await commentsResponse.json()
            if (comments.length > 0) {
              // Use the last comment as the resolution note
              const lastComment = comments[0]
              const author = lastComment.user?.login || 'Unknown'
              resolution = `${lastComment.body}\n\n— ${author}, ${new Date(lastComment.created_at).toLocaleDateString()}`
            }
          }
        } catch {
          // Non-fatal, resolution is optional
        }

        // If no comment, use GitHub's state_reason
        if (!resolution) {
          resolution =
            issueData.state_reason === 'not_planned'
              ? 'Closed as not planned'
              : `Resolved and closed on ${new Date(issueData.closed_at).toLocaleDateString()}`
        }

        // Update feedback entry
        const { error: updateError } = await serviceClient
          .from('feedback')
          .update({
            status: newStatus,
            github_resolution: resolution,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id)

        if (updateError) {
          console.error(`Failed to update feedback ${item.id}:`, updateError)
        } else {
          synced++
          results.push({
            id: item.id,
            issueNumber: item.github_issue_number,
            newStatus,
          })
          console.log(
            `Updated feedback ${item.id}: issue #${item.github_issue_number} → ${newStatus}`
          )
        }
      } catch (err) {
        console.error(`Error syncing issue #${item.github_issue_number}:`, err)
      }
    }

    return createSuccessResponse({
      synced,
      total: feedbackItems.length,
      results,
      message:
        synced > 0
          ? `Updated ${synced} of ${feedbackItems.length} feedback items from GitHub`
          : 'All feedback items are already up to date',
    })
  },
  {
    requireAuth: true,
    allowedMethods: ['POST', 'OPTIONS'],
    logActivity: true,
  }
)
