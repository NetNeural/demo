'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Bug, Lightbulb, Send, Loader2, ImagePlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { useUser } from '@/contexts/UserContext'
import { useOrganization } from '@/contexts/OrganizationContext'
import { createClient } from '@/lib/supabase/client'
import { getSupabaseUrl } from '@/lib/supabase/config'

interface FeedbackFormProps {
  onSubmitted?: () => void
}

export function FeedbackForm({ onSubmitted }: FeedbackFormProps) {
  const { user } = useUser()
  const { currentOrganization } = useOrganization()
  const supabase = createClient()

  const [type, setType] = useState<'bug_report' | 'feature_request'>(
    'bug_report'
  )
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<string>('medium')
  const [bugOccurredDate, setBugOccurredDate] = useState('')
  const [bugOccurredTime, setBugOccurredTime] = useState('')
  const [bugTimezone, setBugTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  )
  const [screenshots, setScreenshots] = useState<File[]>([])
  const [screenshotPreviews, setScreenshotPreviews] = useState<string[]>([])
  const [uploadingScreenshots, setUploadingScreenshots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [recentlySubmitted, setRecentlySubmitted] = useState(false)

  const MAX_SCREENSHOTS = 3
  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

  const handleScreenshotAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const remaining = MAX_SCREENSHOTS - screenshots.length
    if (remaining <= 0) {
      toast.error(`Maximum ${MAX_SCREENSHOTS} screenshots allowed`)
      return
    }

    const validFiles = files.slice(0, remaining).filter((file) => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image file`)
        return false
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} exceeds 5MB limit`)
        return false
      }
      return true
    })

    if (validFiles.length === 0) return

    // Create previews
    validFiles.forEach((file) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setScreenshotPreviews((prev) => [...prev, reader.result as string])
      }
      reader.readAsDataURL(file)
    })

    setScreenshots((prev) => [...prev, ...validFiles])
    // Reset the input so same file can be re-selected
    e.target.value = ''
  }

  const handleScreenshotRemove = (index: number) => {
    setScreenshots((prev) => prev.filter((_, i) => i !== index))
    setScreenshotPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  const uploadScreenshots = async (): Promise<string[]> => {
    if (screenshots.length === 0) return []

    setUploadingScreenshots(true)
    const urls: string[] = []

    try {
      for (const file of screenshots) {
        const ext = file.name.split('.').pop() || 'png'
        const path = `${user?.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

        const { error } = await supabase.storage
          .from('feedback-attachments')
          .upload(path, file, { contentType: file.type })

        if (error) {
          console.error('Screenshot upload failed:', error)
          toast.error(`Failed to upload ${file.name}`)
          continue
        }

        const { data: urlData } = supabase.storage
          .from('feedback-attachments')
          .getPublicUrl(path)

        if (urlData?.publicUrl) {
          urls.push(urlData.publicUrl)
        }
      }
    } finally {
      setUploadingScreenshots(false)
    }

    return urls
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Prevent duplicate submissions from double-clicks or rapid re-submits
    if (submitting || recentlySubmitted) return

    if (!title.trim() || !description.trim()) {
      toast.error('Please fill in both the title and description.')
      return
    }

    if (!currentOrganization) {
      toast.error('Please select an organization first.')
      return
    }

    setSubmitting(true)

    try {
      // Upload screenshots first (if any)
      const screenshotUrls = await uploadScreenshots()

      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('Not authenticated')
        return
      }

      const supabaseUrl = getSupabaseUrl()
      const response = await fetch(
        `${supabaseUrl}/functions/v1/feedback-submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            organizationId: currentOrganization.id,
            type,
            title: title.trim(),
            description: description.trim(),
            severity: type === 'bug_report' ? severity : undefined,
            bugOccurredDate:
              type === 'bug_report' ? bugOccurredDate || undefined : undefined,
            bugOccurredTime:
              type === 'bug_report' ? bugOccurredTime || undefined : undefined,
            bugTimezone:
              type === 'bug_report' ? bugTimezone || undefined : undefined,
            screenshotUrls:
              screenshotUrls.length > 0 ? screenshotUrls : undefined,
            browserInfo: navigator.userAgent,
            pageUrl: window.location.href,
          }),
        }
      )

      const result = await response.json()

      if (!response.ok || result.error) {
        throw new Error(result.message || result.error || 'Submission failed')
      }

      toast.success(
        result.data?.feedback?.github_issue_url
          ? `Feedback submitted! GitHub issue #${result.data.feedback.github_issue_number} created.`
          : 'Feedback submitted! Your feedback has been recorded.'
      )

      // Reset form and apply cooldown to prevent duplicates
      setTitle('')
      setDescription('')
      setSeverity('medium')
      setBugOccurredDate('')
      setBugOccurredTime('')
      setBugTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
      setScreenshots([])
      setScreenshotPreviews([])
      setRecentlySubmitted(true)
      setTimeout(() => setRecentlySubmitted(false), 10000) // 10s cooldown
      onSubmitted?.()
    } catch (error) {
      console.error('Feedback submission error:', error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Submission failed. Please try again.'
      )
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
                <Bug className="mr-2 h-4 w-4" />
                Bug Report
              </Button>
              <Button
                type="button"
                variant={type === 'feature_request' ? 'default' : 'outline'}
                onClick={() => setType('feature_request')}
                className="flex-1"
              >
                <Lightbulb className="mr-2 h-4 w-4" />
                Feature Request
              </Button>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="feedback-title">Title *</Label>
            <Input
              id="feedback-title"
              placeholder={
                type === 'bug_report'
                  ? 'Brief description of the bug...'
                  : 'What feature would you like?'
              }
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
            <p className="text-xs text-muted-foreground">
              Markdown formatting is supported.
            </p>
          </div>

          {/* Severity (bugs only) */}
          {type === 'bug_report' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">
                      <span className="flex items-center gap-2">
                        <Badge variant="destructive" className="text-xs">
                          Critical
                        </Badge>
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
                        <Badge variant="secondary" className="text-xs">
                          Low
                        </Badge>
                        Cosmetic or minor inconvenience
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bug-occurred-date">Date Observed</Label>
                  <Input
                    id="bug-occurred-date"
                    type="date"
                    value={bugOccurredDate}
                    onChange={(e) => setBugOccurredDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bug-occurred-time">Time Observed</Label>
                  <Input
                    id="bug-occurred-time"
                    type="time"
                    value={bugOccurredTime}
                    onChange={(e) => setBugOccurredTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Time Zone</Label>
                <Select value={bugTimezone} onValueChange={setBugTimezone}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select time zone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/Los_Angeles">
                      America/Los_Angeles
                    </SelectItem>
                    <SelectItem value="America/Denver">
                      America/Denver
                    </SelectItem>
                    <SelectItem value="America/Chicago">
                      America/Chicago
                    </SelectItem>
                    <SelectItem value="America/New_York">
                      America/New_York
                    </SelectItem>
                    <SelectItem value="America/Phoenix">
                      America/Phoenix
                    </SelectItem>
                    <SelectItem value="Europe/London">Europe/London</SelectItem>
                    <SelectItem value="Europe/Berlin">Europe/Berlin</SelectItem>
                    <SelectItem value="Asia/Kolkata">Asia/Kolkata</SelectItem>
                    <SelectItem value="Asia/Singapore">
                      Asia/Singapore
                    </SelectItem>
                    <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                    <SelectItem value="Australia/Sydney">
                      Australia/Sydney
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Add when the issue occurred for accurate debugging timelines.
                </p>
              </div>
            </div>
          )}

          {/* Screenshots */}
          <div className="space-y-2">
            <Label>Screenshots (optional)</Label>
            <p className="text-xs text-muted-foreground">
              Attach up to {MAX_SCREENSHOTS} screenshots (max 5MB each). PNG,
              JPG, WebP, or GIF.
            </p>

            {/* Preview grid */}
            {screenshotPreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {screenshotPreviews.map((preview, index) => (
                  <div
                    key={index}
                    className="group relative overflow-hidden rounded-md border"
                  >
                    <img
                      src={preview}
                      alt={`Screenshot ${index + 1}`}
                      className="h-24 w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleScreenshotRemove(index)}
                      className="absolute right-1 top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {screenshots.length < MAX_SCREENSHOTS && (
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                <ImagePlus className="h-4 w-4" />
                <span>
                  Add screenshot
                  {screenshots.length > 0
                    ? ` (${screenshots.length}/${MAX_SCREENSHOTS})`
                    : ''}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                  onChange={handleScreenshotAdd}
                  className="hidden"
                  multiple
                />
              </label>
            )}
          </div>

          {/* Context info */}
          <div className="space-y-1 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <p>
              <strong>Organization:</strong> {currentOrganization?.name}
            </p>
            <p>
              <strong>Submitted by:</strong> {user?.email}
            </p>
            <p>Browser info and page URL will be included automatically.</p>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={
              submitting ||
              uploadingScreenshots ||
              recentlySubmitted ||
              !title.trim() ||
              !description.trim()
            }
            className="w-full"
          >
            {submitting || uploadingScreenshots ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {uploadingScreenshots
                  ? 'Uploading screenshots...'
                  : 'Submitting...'}
              </>
            ) : recentlySubmitted ? (
              <>
                <Send className="mr-2 h-4 w-4" />
                Submitted ✓
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Submit Feedback
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
