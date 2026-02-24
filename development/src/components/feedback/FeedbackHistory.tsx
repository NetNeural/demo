'use client'

import { useEffect, useState, useCallback } from 'react'
import { useDateFormatter } from '@/hooks/useDateFormatter'
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
import {
  ExternalLink,
  Bug,
  Lightbulb,
  RefreshCw,
  Loader2,
  Trash2,
  Pencil,
  CheckCircle2,
  ArrowDownFromLine,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useUser } from '@/contexts/UserContext'
import { toast } from 'sonner'
import { FeedbackDetailDialog } from './FeedbackDetailDialog'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface FeedbackItem {
  id: string
  user_id: string
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
  const { user } = useUser()
  const { fmt } = useDateFormatter()
  const supabase = createClient()
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null)
  const [editingItem, setEditingItem] = useState<FeedbackItem | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editSeverity, setEditSeverity] = useState<
    'critical' | 'high' | 'medium' | 'low'
  >('medium')
  const [savingEdit, setSavingEdit] = useState(false)

  const fetchFeedback = useCallback(async () => {
    if (!currentOrganization) return

    setLoading(true)
    try {
      // Cast to any — the 'feedback' table is created by migration 20260218000003
      // and types will be regenerated after it's applied
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('feedback')
        .select(
          'id, user_id, type, title, description, severity, status, github_issue_number, github_issue_url, github_resolution, created_at'
        )
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
    if (!user?.id) {
      toast.error('You must be signed in to delete feedback')
      return
    }

    setDeletingId(id)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('feedback')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error deleting feedback:', error)
        toast.error(error.message || 'Could not delete feedback')
      } else {
        setItems((prev) => prev.filter((item) => item.id !== id))
        toast.success(`"${title}" has been removed.`)
      }
    } catch (err) {
      console.error('Delete error:', err)
      toast.error('Failed to delete feedback')
    } finally {
      setDeletingId(null)
    }
  }

  const handleOpenEdit = (item: FeedbackItem) => {
    setEditingItem(item)
    setEditTitle(item.title)
    setEditDescription(item.description)
    setEditSeverity(
      (item.severity as 'critical' | 'high' | 'medium' | 'low' | null) ||
        'medium'
    )
  }

  const handleSaveEdit = async () => {
    if (!editingItem || !user?.id) return

    if (!editTitle.trim() || !editDescription.trim()) {
      toast.error('Title and description are required')
      return
    }

    setSavingEdit(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('feedback')
        .update({
          title: editTitle.trim(),
          description: editDescription.trim(),
          severity: editingItem.type === 'bug_report' ? editSeverity : null,
        })
        .eq('id', editingItem.id)
        .eq('user_id', user.id)
        .select(
          'id, user_id, type, title, description, severity, status, github_issue_number, github_issue_url, github_resolution, created_at'
        )
        .single()

      if (error) {
        console.error('Error updating feedback:', error)
        toast.error(error.message || 'Could not delete feedback')
      } else {
        const updated = data as FeedbackItem
        setItems((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item))
        )
        toast.success('Feedback updated')
        setEditingItem(null)
      }
    } catch (err) {
      console.error('Update feedback error:', err)
      toast.error('Failed to update feedback')
    } finally {
      setSavingEdit(false)
    }
  }

  /** Sync GitHub issue statuses back to the feedback table */
  const handleSyncFromGitHub = async () => {
    if (!currentOrganization) return

    setSyncing(true)
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const session = (await supabase.auth.getSession()).data.session

      const response = await fetch(
        `${supabaseUrl}/functions/v1/feedback-sync`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ organizationId: currentOrganization.id }),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        toast.error(result.error?.message || 'Could not sync from GitHub')
        return
      }

      const { synced, total } = result.data || {}
      if (synced > 0) {
        toast.success(
          `Updated ${synced} of ${total} feedback items from GitHub.`
        )
        // Refresh the list to show updated statuses
        await fetchFeedback()
      } else {
        toast.info(
          'All feedback items already match their GitHub issue status.'
        )
      }
    } catch (err) {
      console.error('Sync error:', err)
      toast.error('Failed to sync feedback status from GitHub')
    } finally {
      setSyncing(false)
    }
  }

  // Auto-sync from GitHub on load so closed issues move to "Closed Tickets"
  const syncFromGitHubSilent = useCallback(async () => {
    if (!currentOrganization) return
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const session = (await supabase.auth.getSession()).data.session
      if (!session?.access_token) return

      const response = await fetch(
        `${supabaseUrl}/functions/v1/feedback-sync`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ organizationId: currentOrganization.id }),
        }
      )

      if (response.ok) {
        const result = await response.json()
        if (result.data?.synced > 0) {
          // Silently refresh the list with updated statuses
          await fetchFeedback()
        }
      }
    } catch {
      // Silent — don't bother user if background sync fails
    }
  }, [currentOrganization, supabase, fetchFeedback])

  useEffect(() => {
    fetchFeedback()
  }, [fetchFeedback, refreshKey])

  // Auto-sync GitHub status after initial load
  const [hasAutoSynced, setHasAutoSynced] = useState(false)
  useEffect(() => {
    if (!loading && items.length > 0 && !hasAutoSynced) {
      setHasAutoSynced(true)
      syncFromGitHubSilent()
    }
  }, [loading, items.length, hasAutoSynced, syncFromGitHubSilent])

  const openItems = items.filter(
    (item) => item.status !== 'resolved' && item.status !== 'closed'
  )
  const closedItems = items.filter(
    (item) => item.status === 'resolved' || item.status === 'closed'
  )

  const renderFeedbackItem = (item: FeedbackItem) => {
    const isResolved = item.status === 'resolved' || item.status === 'closed'
    const isOwner = item.user_id === user?.id

    return (
      <div
        key={item.id}
        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 ${isResolved ? 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20' : ''}`}
        onClick={() => setSelectedItem(item)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setSelectedItem(item)
        }}
      >
        <div className="mt-0.5">
          {isResolved ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : item.type === 'bug_report' ? (
            <Bug className="h-4 w-4 text-red-500" />
          ) : (
            <Lightbulb className="h-4 w-4 text-yellow-500" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`truncate text-sm font-medium ${isResolved ? 'text-muted-foreground line-through' : ''}`}
            >
              {item.title}
            </span>
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
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {item.description}
          </p>

          {isResolved && item.github_resolution && (
            <p className="mt-1 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3 w-3" />
              Resolved — click to see details
            </p>
          )}

          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{fmt.shortDateTime(item.created_at)}</span>
            {item.github_issue_url && (
              <a
                href={item.github_issue_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-3 w-3" />#{item.github_issue_number}
              </a>
            )}
          </div>
        </div>

        {isOwner && (
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
          <div onClick={(e) => e.stopPropagation()} className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-muted-foreground"
              onClick={() => handleOpenEdit(item)}
              aria-label={`Edit feedback ${item.title}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-muted-foreground hover:text-red-600"
                  disabled={deletingId === item.id}
                  aria-label={`Delete feedback ${item.title}`}
                >
                  {deletingId === item.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Feedback?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete &quot;{item.title}&quot;.
                    {item.github_issue_url && (
                      <>
                        {' '}
                        The linked GitHub issue (#{item.github_issue_number})
                        will not be deleted.
                      </>
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
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Feedback History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <ArrowDownFromLine className="mr-1 h-4 w-4" />
            )}
            {syncing ? 'Syncing...' : 'Sync from GitHub'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchFeedback}
            aria-label="Refresh feedback"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>No feedback submitted yet.</p>
            <p className="mt-1 text-sm">
              Use the form to submit your first bug report or feature request.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Open Tickets</h3>
                <Badge variant="secondary" className="text-xs">
                  {openItems.length}
                </Badge>
              </div>
              {openItems.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No open feedback tickets.
                </p>
              ) : (
                openItems.map(renderFeedbackItem)
              )}
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Closed Tickets</h3>
                <Badge variant="secondary" className="text-xs">
                  {closedItems.length}
                </Badge>
              </div>
              {closedItems.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No closed feedback tickets.
                </p>
              ) : (
                closedItems.map(renderFeedbackItem)
              )}
            </div>
          </div>
        )}
      </CardContent>

      <FeedbackDetailDialog
        item={selectedItem}
        open={!!selectedItem}
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null)
        }}
      />

      <Dialog
        open={!!editingItem}
        onOpenChange={(open) => {
          if (!open) setEditingItem(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Feedback</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-feedback-title">Title</Label>
              <Input
                id="edit-feedback-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={255}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-feedback-description">Description</Label>
              <Textarea
                id="edit-feedback-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={6}
              />
            </div>

            {editingItem?.type === 'bug_report' && (
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select
                  value={editSeverity}
                  onValueChange={(value) =>
                    setEditSeverity(
                      value as 'critical' | 'high' | 'medium' | 'low'
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingItem(null)}
              disabled={savingEdit}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
