'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Bug, Lightbulb, Send, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useUser } from '@/contexts/UserContext'
import { useOrganization } from '@/contexts/OrganizationContext'
import { createClient } from '@/lib/supabase/client'
import { getSupabaseUrl } from '@/lib/supabase/config'

interface FeedbackFormProps {
  onSubmitted?: () => void
}

export function FeedbackForm({ onSubmitted }: FeedbackFormProps) {
  const { toast } = useToast()
  const { user } = useUser()
  const { currentOrganization } = useOrganization()
  const supabase = createClient()

  const [type, setType] = useState<'bug_report' | 'feature_request'>('bug_report')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<string>('medium')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !description.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in both the title and description.',
        variant: 'destructive',
      })
      return
    }

    if (!currentOrganization) {
      toast({
        title: 'No organization selected',
        description: 'Please select an organization first.',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast({ title: 'Not authenticated', variant: 'destructive' })
        return
      }

      const supabaseUrl = getSupabaseUrl()
      const response = await fetch(`${supabaseUrl}/functions/v1/feedback-submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          organizationId: currentOrganization.id,
          type,
          title: title.trim(),
          description: description.trim(),
          severity: type === 'bug_report' ? severity : undefined,
          browserInfo: navigator.userAgent,
          pageUrl: window.location.href,
        }),
      })

      const result = await response.json()

      if (!response.ok || result.error) {
        throw new Error(result.message || result.error || 'Submission failed')
      }

      toast({
        title: 'Feedback submitted!',
        description: result.data?.feedback?.github_issue_url
          ? `GitHub issue #${result.data.feedback.github_issue_number} created.`
          : 'Your feedback has been recorded.',
      })

      // Reset form
      setTitle('')
      setDescription('')
      setSeverity('medium')
      onSubmitted?.()
    } catch (error) {
      console.error('Feedback submission error:', error)
      toast({
        title: 'Submission failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Submit Feedback</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Type Selector */}
          <div className="space-y-2">
            <Label>Feedback Type</Label>
            <div className="flex gap-3">
              <Button
                type="button"
                variant={type === 'bug_report' ? 'default' : 'outline'}
                onClick={() => setType('bug_report')}
                className="flex-1"
              >
                <Bug className="w-4 h-4 mr-2" />
                Bug Report
              </Button>
              <Button
                type="button"
                variant={type === 'feature_request' ? 'default' : 'outline'}
                onClick={() => setType('feature_request')}
                className="flex-1"
              >
                <Lightbulb className="w-4 h-4 mr-2" />
                Feature Request
              </Button>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="feedback-title">Title *</Label>
            <Input
              id="feedback-title"
              placeholder={type === 'bug_report' ? 'Brief description of the bug...' : 'What feature would you like?'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={255}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="feedback-description">Description *</Label>
            <Textarea
              id="feedback-description"
              placeholder={
                type === 'bug_report'
                  ? 'Steps to reproduce:\n1. Go to...\n2. Click on...\n3. See error...\n\nExpected behavior:\n\nActual behavior:'
                  : 'Describe the feature you would like and why it would be useful...'
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              required
            />
            <p className="text-xs text-muted-foreground">Markdown formatting is supported.</p>
          </div>

          {/* Severity (bugs only) */}
          {type === 'bug_report' && (
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">
                    <span className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-xs">Critical</Badge>
                      System down or data loss
                    </span>
                  </SelectItem>
                  <SelectItem value="high">
                    <span className="flex items-center gap-2">
                      <Badge className="bg-orange-500 text-xs">High</Badge>
                      Major feature broken
                    </span>
                  </SelectItem>
                  <SelectItem value="medium">
                    <span className="flex items-center gap-2">
                      <Badge className="bg-yellow-500 text-xs">Medium</Badge>
                      Minor issue, workaround exists
                    </span>
                  </SelectItem>
                  <SelectItem value="low">
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">Low</Badge>
                      Cosmetic or minor inconvenience
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Context info */}
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
            <p><strong>Organization:</strong> {currentOrganization?.name}</p>
            <p><strong>Submitted by:</strong> {user?.email}</p>
            <p>Browser info and page URL will be included automatically.</p>
          </div>

          {/* Submit */}
          <Button type="submit" disabled={submitting || !title.trim() || !description.trim()} className="w-full">
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Submit Feedback
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
