// ===========================================================================
// Edge Function: feedback-comments
// ===========================================================================
// Fetches GitHub issue comments for a specific feedback item.
// Returns the issue body + all comments as a conversation thread.
//
// Query params (via POST body):
//   - feedbackId (required): the feedback row id
//   - organizationId (required): for membership check
// ===========================================================================

import {
  createEdgeFunction,
  createSuccessResponse,
  createErrorResponse,
  DatabaseError,
} from '../_shared/request-handler.ts'
import { createServiceClient } from '../_shared/auth.ts'

const GITHUB_REPO = 'NetNeural/MonoRepo-Staging'

interface GitHubComment {
  author: string
  authorAvatar: string
  body: string
  createdAt: string
  isBot: boolean
}

interface GitHubIssueDetail {
  number: number
  title: string
  state: string
  stateReason: string | null
  createdAt: string
  closedAt: string | null
  labels: string[]
  body: string
  comments: GitHubComment[]
  url: string
}

export default createEdgeFunction(
  async ({ req, userContext }) => {
    if (req.method !== 'POST') {
      return createErrorResponse('Only POST method is supported', 405)
    }

    const user = userContext!
    const body = await req.json()
    const { feedbackId, organizationId } = body

    if (!feedbackId || !organizationId) {
      throw new DatabaseError('feedbackId and organizationId are required', 400)
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

    // Get the feedback entry
    const { data: feedback, error: feedbackError } = await serviceClient
      .from('feedback')
      .select('id, github_issue_number, organization_id')
      .eq('id', feedbackId)
      .eq('organization_id', organizationId)
      .single()

    if (feedbackError || !feedback) {
      throw new DatabaseError('Feedback item not found', 404)
    }

    if (!feedback.github_issue_number) {
      return createSuccessResponse({
        issue: null,
        message: 'This feedback item is not linked to a GitHub issue',
      })
    }

    const headers = {
      Authorization: `token ${githubToken}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'NetNeural-Feedback-Comments',
    }

    // Fetch the issue itself
    const issueResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/issues/${feedback.github_issue_number}`,
      { headers }
    )

    if (!issueResponse.ok) {
      console.error(`GitHub API error: ${issueResponse.status}`)
      throw new DatabaseError('Failed to fetch GitHub issue', 502)
    }

    const issueData = await issueResponse.json()

    // Fetch all comments
    const commentsResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/issues/${feedback.github_issue_number}/comments?per_page=100&sort=created&direction=asc`,
      { headers }
    )

    let comments: GitHubComment[] = []
    if (commentsResponse.ok) {
      const rawComments = await commentsResponse.json()
      comments = rawComments.map(
        (c: {
          user?: { login: string; avatar_url: string; type: string }
          body: string
          created_at: string
        }) => ({
          author: c.user?.login || 'Unknown',
          authorAvatar: c.user?.avatar_url || '',
          body: c.body || '',
          createdAt: c.created_at,
          isBot: c.user?.type === 'Bot',
        })
      )
    }

    const issue: GitHubIssueDetail = {
      number: issueData.number,
      title: issueData.title,
      state: issueData.state,
      stateReason: issueData.state_reason || null,
      createdAt: issueData.created_at,
      closedAt: issueData.closed_at || null,
      labels: (issueData.labels || []).map((l: { name: string }) => l.name),
      body: issueData.body || '',
      comments,
      url: issueData.html_url,
    }

    return createSuccessResponse({ issue })
  },
  {
    requireAuth: true,
    allowedMethods: ['POST', 'OPTIONS'],
    logActivity: false,
  }
)
