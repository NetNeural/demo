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
import { ExternalLink, Bug, Lightbulb, RefreshCw, Loader2, Trash2 } from 'lucide-react'
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
  const [deletingId, setDeletingId] = useState<string | null>(null)
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
        .select('id, type, title, description, severity, status, github_issue_number, github_issue_url, created_at')
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
        <Button variant="ghost" size="sm" onClick={fetchFeedback}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No feedback submitted yet.</p>
            <p className="text-sm mt-1">Use the form to submit your first bug report or feature request.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                {/* Type icon */}
                <div className="mt-0.5">
                  {item.type === 'bug_report' ? (
                    <Bug className="w-4 h-4 text-red-500" />
                  ) : (
                    <Lightbulb className="w-4 h-4 text-yellow-500" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{item.title}</span>
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
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
