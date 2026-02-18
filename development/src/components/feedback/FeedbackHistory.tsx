'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ExternalLink, Bug, Lightbulb, RefreshCw, Loader2, Trash2, CheckCircle2, GitPullRequestClosed, ArrowDownFromLine } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useToast } from '@/hooks/use-toast'

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

interface FeedbackHistoryProps {
  refreshKey?: number
}

export function FeedbackHistory({ refreshKey }: FeedbackHistoryProps) {
  const { currentOrganization } = useOrganization()
  const supabase = createClient()
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { toast } = useToast()

  const fetchFeedback = useCallback(async () => {
    if (!currentOrganization) return

    setLoading(true)
    try {
      // Cast to any — the 'feedback' table is created by migration 20260218000003
      // and types will be regenerated after it's applied
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('feedback')
        .select('id, type, title, description, severity, status, github_issue_number, github_issue_url, github_resolution, created_at')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Error fetching feedback:', error)
      } else {
        setItems((data as FeedbackItem[]) || [])
      }
    } finally {
      setLoading(false)
    }
  }, [currentOrganization, supabase])

  const handleDelete = async (id: string, title: string) => {
    setDeletingId(id)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('feedback')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error deleting feedback:', error)
        toast({
          title: 'Delete Failed',
          description: error.message || 'Could not delete feedback',
          variant: 'destructive',
        })
      } else {
        setItems((prev) => prev.filter((item) => item.id !== id))
        toast({
          title: 'Feedback Deleted',
          description: `"${title}" has been removed.`,
        })
      }
    } catch (err) {
      console.error('Delete error:', err)
      toast({
        title: 'Error',
        description: 'Failed to delete feedback',
        variant: 'destructive',
      })
    } finally {
      setDeletingId(null)
    }
  }

  /** Sync GitHub issue statuses back to the feedback table */
  const handleSyncFromGitHub = async () => {
    if (!currentOrganization) return

    setSyncing(true)
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const session = (await supabase.auth.getSession()).data.session

      const response = await fetch(`${supabaseUrl}/functions/v1/feedback-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ organizationId: currentOrganization.id }),
      })

      const result = await response.json()

      if (!response.ok) {
        toast({
          title: 'Sync Failed',
          description: result.error?.message || 'Could not sync from GitHub',
          variant: 'destructive',
        })
        return
      }

      const { synced, total } = result.data || {}
      if (synced > 0) {
        toast({
          title: 'GitHub Status Synced',
          description: `Updated ${synced} of ${total} feedback items from GitHub.`,
        })
        // Refresh the list to show updated statuses
        await fetchFeedback()
      } else {
        toast({
          title: 'Already Up to Date',
          description: 'All feedback items match their GitHub issue status.',
        })
      }
    } catch (err) {
      console.error('Sync error:', err)
      toast({
        title: 'Sync Error',
        description: 'Failed to sync feedback status from GitHub',
        variant: 'destructive',
      })
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    fetchFeedback()
  }, [fetchFeedback, refreshKey])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Feedback History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Feedback History</CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncFromGitHub}
            disabled={syncing || items.length === 0}
            title="Sync status from GitHub issues"
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <ArrowDownFromLine className="w-4 h-4 mr-1" />
            )}
            {syncing ? 'Syncing...' : 'Sync from GitHub'}
          </Button>
          <Button variant="ghost" size="sm" onClick={fetchFeedback}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No feedback submitted yet.</p>
            <p className="text-sm mt-1">Use the form to submit your first bug report or feature request.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const isResolved = item.status === 'resolved' || item.status === 'closed'
              return (
              <div
                key={item.id}
                className={`flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors ${isResolved ? 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20' : ''}`}
              >
                {/* Type icon */}
                <div className="mt-0.5">
                  {isResolved ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : item.type === 'bug_report' ? (
                    <Bug className="w-4 h-4 text-red-500" />
                  ) : (
                    <Lightbulb className="w-4 h-4 text-yellow-500" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-medium text-sm truncate ${isResolved ? 'line-through text-muted-foreground' : ''}`}>{item.title}</span>
                    <Badge className={`${STATUS_COLORS[item.status] || 'bg-gray-500'} text-white text-[10px] px-1.5 py-0`}>
                      {STATUS_LABELS[item.status] || item.status}
                    </Badge>
                    {item.severity && (
                      <Badge className={`${SEVERITY_COLORS[item.severity] || 'bg-gray-400'} text-white text-[10px] px-1.5 py-0`}>
                        {item.severity}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {item.description}
                  </p>

                  {/* Resolution note from GitHub */}
                  {isResolved && item.github_resolution && (
                    <div className="mt-2 p-2 rounded bg-green-100/60 dark:bg-green-950/40 border border-green-200 dark:border-green-800">
                      <button
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        className="flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 w-full text-left"
                      >
                        <GitPullRequestClosed className="w-3 h-3" />
                        Resolution from GitHub
                        <span className="ml-auto text-[10px]">{expandedId === item.id ? '▲' : '▼'}</span>
                      </button>
                      {expandedId === item.id && (
                        <p className="text-xs text-green-800 dark:text-green-300 mt-1 whitespace-pre-wrap">
                          {item.github_resolution}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{new Date(item.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}</span>
                    {item.github_issue_url && (
                      <a
                        href={item.github_issue_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400"
                      >
                        <ExternalLink className="w-3 h-3" />
                        #{item.github_issue_number}
                      </a>
                    )}
                  </div>
                </div>

                {/* Delete button */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-muted-foreground hover:text-red-600"
                      disabled={deletingId === item.id}
                    >
                      {deletingId === item.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Feedback?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete &quot;{item.title}&quot;.
                        {item.github_issue_url && (
                          <> The linked GitHub issue (#{item.github_issue_number}) will not be deleted.</>
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(item.id, item.title)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
