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
import { Textarea } from '@/components/ui/textarea'
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
  Send,
  HelpCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useUser } from '@/contexts/UserContext'
import { getSupabaseUrl } from '@/lib/supabase/config'
import { toast } from 'sonner'

interface FeedbackItem {
  id: string
  user_id?: string
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
  needs_info: 'bg-amber-500',
  resolved: 'bg-green-500',
  closed: 'bg-gray-500',
}

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  acknowledged: 'Acknowledged',
  in_progress: 'In Progress',
  needs_info: 'Needs Info',
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
  onUpdate?: (updatedItem: FeedbackItem) => void
}

export function FeedbackDetailDialog({
  item,
  open,
  onOpenChange,
  onUpdate,
}: FeedbackDetailDialogProps) {
  const { fmt } = useDateFormatter()
  const { currentOrganization, isAdmin, isOwner } = useOrganization()
  const { user } = useUser()
  const supabase = createClient()
  const [issueDetail, setIssueDetail] = useState<GitHubIssueDetail | null>(null)
  const [loadingComments, setLoadingComments] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [requestingInfo, setRequestingInfo] = useState(false)

  const isSubmitter = item?.user_id === user?.id
  const isAdminOrAbove = isAdmin || isOwner

  const handlePostComment = async (
    action: 'comment' | 'request-info' = 'comment'
  ) => {
    if (!replyText.trim() || !item || !currentOrganization) return

    const setter = action === 'request-info' ? setRequestingInfo : setSendingReply
    setter(true)

    try {
      const supabaseUrl = getSupabaseUrl()
      const session = (await supabase.auth.getSession()).data.session

      const response = await fetch(
        `${supabaseUrl}/functions/v1/feedback-reply`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            feedbackId: item.id,
            organizationId: currentOrganization.id,
            action,
            comment: replyText.trim(),
          }),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        toast.error(result.error?.message || 'Failed to post comment')
        return
      }

      toast.success(
        action === 'request-info'
          ? 'Information request sent to submitter'
          : 'Reply posted successfully'
      )
      setReplyText('')

      // If request-info, update the item's status locally
      if (action === 'request-info' && onUpdate && item) {
        onUpdate({ ...item, status: 'needs_info' })
      }

      // Refresh comments
      await fetchIssueComments()
    } catch {
      toast.error('Failed to send reply')
    } finally {
      setter(false)
    }
  }

  const fetchIssueComments = async () => {
    if (!item || !item.github_issue_number || !currentOrganization) return

    setLoadingComments(true)
    setError(null)
    try {
      const supabaseUrl = getSupabaseUrl()
      const session = (await supabase.auth.getSession()).data.session

      const response = await fetch(
        `${supabaseUrl}/functions/v1/feedback-comments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            feedbackId: item.id,
            organizationId: currentOrganization.id,
          }),
        }
      )

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

  useEffect(() => {
    if (!open || !item || !item.github_issue_number || !currentOrganization) {
      setIssueDetail(null)
      setError(null)
      setReplyText('')
      return
    }

    fetchIssueComments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id, currentOrganization?.id])

  if (!item) return null

  const isResolved = item.status === 'resolved' || item.status === 'closed'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <div className="flex items-start gap-3 pr-8">
            <div className="mt-1">
              {isResolved ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : item.type === 'bug_report' ? (
                <Bug className="h-5 w-5 text-red-500" />
              ) : (
                <Lightbulb className="h-5 w-5 text-yellow-500" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base leading-snug">
                {item.title}
              </DialogTitle>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge
                  className={`${STATUS_COLORS[item.status] || 'bg-gray-500'} px-1.5 py-0 text-[10px] text-white`}
                >
                  {STATUS_LABELS[item.status] || item.status}
                </Badge>
                {item.severity && (
                  <Badge
                    className={`${SEVERITY_COLORS[item.severity] || 'bg-gray-400'} px-1.5 py-0 text-[10px] text-white`}
                  >
                    {item.severity}
                  </Badge>
                )}
                <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                  {item.type === 'bug_report'
                    ? 'Bug Report'
                    : 'Feature Request'}
                </Badge>
                {item.github_issue_number && (
                  <a
                    href={item.github_issue_url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 dark:text-blue-400"
                  >
                    <ExternalLink className="h-3 w-3" />#
                    {item.github_issue_number}
                  </a>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="-mr-1 flex-1 space-y-4 overflow-y-auto pr-1">
          {/* Submitted description */}
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Submitted {fmt.shortDateTime(item.created_at)}
            </div>
            <div className="whitespace-pre-wrap rounded-lg border bg-muted/50 p-3 text-sm">
              {item.description}
            </div>
          </div>

          {/* Resolution from sync (if available but no GitHub comments loaded) */}
          {isResolved &&
            item.github_resolution &&
            !issueDetail &&
            !loadingComments && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/30">
                <div className="mb-1 flex items-center gap-2 text-xs font-medium text-green-700 dark:text-green-400">
                  <GitPullRequestClosed className="h-3 w-3" />
                  Resolution
                </div>
                <p className="whitespace-pre-wrap text-sm text-green-800 dark:text-green-300">
                  {item.github_resolution}
                </p>
              </div>
            )}

          <Separator />

          {/* GitHub Communication Thread */}
          {item.github_issue_number ? (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Communication</h3>
                {issueDetail && (
                  <span className="text-xs text-muted-foreground">
                    {issueDetail.comments.length}{' '}
                    {issueDetail.comments.length === 1 ? 'comment' : 'comments'}
                  </span>
                )}
              </div>

              {loadingComments ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Loading GitHub conversation...
                  </span>
                </div>
              ) : error ? (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              ) : issueDetail ? (
                <div className="space-y-3">
                  {/* Issue body (original GitHub issue description) */}
                  {issueDetail.body && (
                    <div className="relative border-l-2 border-blue-300 pl-4 dark:border-blue-700">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
                          Issue Created
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {fmt.timeAgo(issueDetail.createdAt)}
                        </span>
                      </div>
                      <div className="line-clamp-6 whitespace-pre-wrap text-xs text-muted-foreground">
                        {issueDetail.body}
                      </div>
                    </div>
                  )}

                  {/* Comments */}
                  {issueDetail.comments.length === 0 && (
                    <p className="py-2 text-xs italic text-muted-foreground">
                      No comments yet on this issue.
                    </p>
                  )}

                  {issueDetail.comments.map((comment, idx) => (
                    <div
                      key={idx}
                      className={`relative border-l-2 pl-4 ${
                        comment.isBot
                          ? 'border-gray-300 dark:border-gray-600'
                          : 'border-violet-300 dark:border-violet-700'
                      }`}
                    >
                      <div className="mb-1 flex items-center gap-2">
                        {comment.authorAvatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={comment.authorAvatar}
                            alt={comment.author}
                            className="h-4 w-4 rounded-full"
                          />
                        ) : (
                          <User className="h-3 w-3 text-muted-foreground" />
                        )}
                        <span className="text-xs font-medium">
                          {comment.author}
                        </span>
                        {comment.isBot && (
                          <Badge
                            variant="outline"
                            className="px-1 py-0 text-[9px]"
                          >
                            bot
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {fmt.timeAgo(comment.createdAt)}
                        </span>
                      </div>
                      <div className="whitespace-pre-wrap text-sm text-foreground">
                        {comment.body}
                      </div>
                    </div>
                  ))}

                  {/* Closed indicator */}
                  {issueDetail.state === 'closed' && issueDetail.closedAt && (
                    <div className="relative border-l-2 border-green-400 pl-4 dark:border-green-600">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                        <span className="text-xs font-medium text-green-700 dark:text-green-400">
                          {issueDetail.stateReason === 'not_planned'
                            ? 'Closed as not planned'
                            : 'Closed as resolved'}
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
            <div className="py-4 text-center text-sm text-muted-foreground">
              <MessageSquare className="mx-auto mb-2 h-5 w-5 opacity-50" />
              <p>No GitHub issue linked to this feedback.</p>
              <p className="mt-1 text-xs">
                Communication tracking is available for items with linked GitHub
                issues.
              </p>
            </div>
          )}
          {/* Needs Info Banner */}
          {item.status === 'needs_info' && isSubmitter && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                <HelpCircle className="h-4 w-4" />
                Additional information requested
              </div>
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
                An admin has requested more details. Please reply below with the
                requested information.
              </p>
            </div>
          )}

          {/* Reply / Comment Section */}
          {item.github_issue_number && !isResolved && (
            <div className="space-y-2">
              <Separator />
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">
                  {isSubmitter
                    ? 'Add More Information'
                    : 'Reply to Submitter'}
                </h3>
              </div>
              <Textarea
                placeholder={
                  isSubmitter
                    ? 'Add additional details or context...'
                    : 'Reply to the submitter...'
                }
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={3}
                className="resize-none text-sm"
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handlePostComment('comment')}
                  disabled={
                    sendingReply || requestingInfo || !replyText.trim()
                  }
                >
                  {sendingReply ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                      {isSubmitter ? 'Add Info' : 'Reply'}
                    </>
                  )}
                </Button>
                {isAdminOrAbove && !isSubmitter && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePostComment('request-info')}
                    disabled={
                      sendingReply || requestingInfo || !replyText.trim()
                    }
                    title="Send reply and mark ticket as needing more info from submitter"
                  >
                    {requestingInfo ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <HelpCircle className="mr-1.5 h-3.5 w-3.5" />
                        Request Info
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t pt-4">
          <span className="text-xs text-muted-foreground">
            {item.github_issue_url ? (
              <a
                href={item.github_issue_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" />
                View on GitHub
              </a>
            ) : (
              'Local feedback only'
            )}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
