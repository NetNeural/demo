'use client'

import { useEffect, useState } from 'react'
import { useDateFormatter } from '@/hooks/useDateFormatter'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Bug,
  Lightbulb,
  ExternalLink,
  Loader2,
  CheckCircle2,
  MessageSquare,
  Clock,
  User,
  AlertCircle,
  GitPullRequestClosed,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useOrganization } from '@/contexts/OrganizationContext'
import { getSupabaseUrl } from '@/lib/supabase/config'

interface FeedbackItem {
  id: string
  type: 'bug_report' | 'feature_request'
  title: string
  description: string
  severity: string | null
  status: string
  github_issue_number: number | null
  github_issue_url: string | null
  github_resolution: string | null
  created_at: string
}

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

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-blue-500',
  acknowledged: 'bg-purple-500',
  in_progress: 'bg-yellow-500',
  resolved: 'bg-green-500',
  closed: 'bg-gray-500',
}

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  acknowledged: 'Acknowledged',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-600',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-gray-400',
}

interface FeedbackDetailDialogProps {
  item: FeedbackItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FeedbackDetailDialog({ item, open, onOpenChange }: FeedbackDetailDialogProps) {
  const { fmt } = useDateFormatter()
  const { currentOrganization } = useOrganization()
  const supabase = createClient()
  const [issueDetail, setIssueDetail] = useState<GitHubIssueDetail | null>(null)
  const [loadingComments, setLoadingComments] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !item || !item.github_issue_number || !currentOrganization) {
      setIssueDetail(null)
      setError(null)
      return
    }

    const fetchComments = async () => {
      setLoadingComments(true)
      setError(null)
      try {
        const supabaseUrl = getSupabaseUrl()
        const session = (await supabase.auth.getSession()).data.session

        const response = await fetch(`${supabaseUrl}/functions/v1/feedback-comments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            feedbackId: item.id,
            organizationId: currentOrganization.id,
          }),
        })

        const result = await response.json()

        if (!response.ok) {
          setError(result.error?.message || 'Failed to load issue details')
          return
        }

        if (result.data?.issue) {
          setIssueDetail(result.data.issue)
        }
      } catch {
        setError('Failed to connect to GitHub')
      } finally {
        setLoadingComments(false)
      }
    }

    fetchComments()
  }, [open, item, currentOrganization, supabase])

  if (!item) return null

  const isResolved = item.status === 'resolved' || item.status === 'closed'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <div className="flex items-start gap-3 pr-8">
            <div className="mt-1">
              {isResolved ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : item.type === 'bug_report' ? (
                <Bug className="w-5 h-5 text-red-500" />
              ) : (
                <Lightbulb className="w-5 h-5 text-yellow-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base leading-snug">
                {item.title}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge className={`${STATUS_COLORS[item.status] || 'bg-gray-500'} text-white text-[10px] px-1.5 py-0`}>
                  {STATUS_LABELS[item.status] || item.status}
                </Badge>
                {item.severity && (
                  <Badge className={`${SEVERITY_COLORS[item.severity] || 'bg-gray-400'} text-white text-[10px] px-1.5 py-0`}>
                    {item.severity}
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {item.type === 'bug_report' ? 'Bug Report' : 'Feature Request'}
                </Badge>
                {item.github_issue_number && (
                  <a
                    href={item.github_issue_url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 dark:text-blue-400"
                  >
                    <ExternalLink className="w-3 h-3" />
                    #{item.github_issue_number}
                  </a>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1 -mr-1">
          {/* Submitted description */}
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <Clock className="w-3 h-3" />
              Submitted {fmt.shortDateTime(item.created_at)}
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border text-sm whitespace-pre-wrap">
              {item.description}
            </div>
          </div>

          {/* Resolution from sync (if available but no GitHub comments loaded) */}
          {isResolved && item.github_resolution && !issueDetail && !loadingComments && (
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 text-xs font-medium text-green-700 dark:text-green-400 mb-1">
                <GitPullRequestClosed className="w-3 h-3" />
                Resolution
              </div>
              <p className="text-sm text-green-800 dark:text-green-300 whitespace-pre-wrap">
                {item.github_resolution}
              </p>
            </div>
          )}

          <Separator />

          {/* GitHub Communication Thread */}
          {item.github_issue_number ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Communication</h3>
                {issueDetail && (
                  <span className="text-xs text-muted-foreground">
                    {issueDetail.comments.length} {issueDetail.comments.length === 1 ? 'comment' : 'comments'}
                  </span>
                )}
              </div>

              {loadingComments ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
                  <span className="text-sm text-muted-foreground">Loading GitHub conversation...</span>
                </div>
              ) : error ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              ) : issueDetail ? (
                <div className="space-y-3">
                  {/* Issue body (original GitHub issue description) */}
                  {issueDetail.body && (
                    <div className="relative pl-4 border-l-2 border-blue-300 dark:border-blue-700">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
                          Issue Created
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {fmt.timeAgo(issueDetail.createdAt)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-6">
                        {issueDetail.body}
                      </div>
                    </div>
                  )}

                  {/* Comments */}
                  {issueDetail.comments.length === 0 && (
                    <p className="text-xs text-muted-foreground italic py-2">
                      No comments yet on this issue.
                    </p>
                  )}

                  {issueDetail.comments.map((comment, idx) => (
                    <div
                      key={idx}
                      className={`relative pl-4 border-l-2 ${
                        comment.isBot 
                          ? 'border-gray-300 dark:border-gray-600' 
                          : 'border-violet-300 dark:border-violet-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {comment.authorAvatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={comment.authorAvatar}
                            alt={comment.author}
                            className="w-4 h-4 rounded-full"
                          />
                        ) : (
                          <User className="w-3 h-3 text-muted-foreground" />
                        )}
                        <span className="text-xs font-medium">
                          {comment.author}
                        </span>
                        {comment.isBot && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0">bot</Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {fmt.timeAgo(comment.createdAt)}
                        </span>
                      </div>
                      <div className="text-sm text-foreground whitespace-pre-wrap">
                        {comment.body}
                      </div>
                    </div>
                  ))}

                  {/* Closed indicator */}
                  {issueDetail.state === 'closed' && issueDetail.closedAt && (
                    <div className="relative pl-4 border-l-2 border-green-400 dark:border-green-600">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3 text-green-600" />
                        <span className="text-xs font-medium text-green-700 dark:text-green-400">
                          {issueDetail.stateReason === 'not_planned' ? 'Closed as not planned' : 'Closed as resolved'}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {fmt.timeAgo(issueDetail.closedAt)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="text-center py-4 text-sm text-muted-foreground">
              <MessageSquare className="w-5 h-5 mx-auto mb-2 opacity-50" />
              <p>No GitHub issue linked to this feedback.</p>
              <p className="text-xs mt-1">Communication tracking is available for items with linked GitHub issues.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between pt-4 border-t">
          <span className="text-xs text-muted-foreground">
            {item.github_issue_url ? (
              <a
                href={item.github_issue_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                View on GitHub
              </a>
            ) : (
              'Local feedback only'
            )}
          </span>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
