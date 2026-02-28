'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Mail,
  Send,
  Sparkles,
  Loader2,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  History,
  Megaphone,
  Wrench,
  Newspaper,
  Bell,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

type EmailType = 'announcement' | 'maintenance' | 'newsletter' | 'update'
type Tone = 'formal' | 'friendly' | 'urgent'

interface BroadcastLog {
  id: string
  subject: string
  email_type: string
  target_tiers: string[]
  recipient_count: number
  status: string
  sent_at: string
  error_message: string | null
}

const EMAIL_TYPE_CONFIG: Record<
  EmailType,
  { label: string; icon: React.ReactNode; description: string; color: string }
> = {
  announcement: {
    label: 'Announcement',
    icon: <Megaphone className="h-4 w-4" />,
    description: 'New features, product updates, company news',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  },
  maintenance: {
    label: 'Maintenance',
    icon: <Wrench className="h-4 w-4" />,
    description: 'Scheduled downtime, system maintenance, service disruptions',
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  },
  newsletter: {
    label: 'Newsletter',
    icon: <Newspaper className="h-4 w-4" />,
    description: 'Monthly/quarterly updates, tips, success stories',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  },
  update: {
    label: 'Platform Update',
    icon: <Bell className="h-4 w-4" />,
    description: 'General platform improvements, policy changes',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  },
}

const TIER_OPTIONS = [
  { value: 'all', label: 'All Users', description: 'Every user on the platform' },
  { value: 'starter', label: 'Starter', description: 'Starter tier organizations' },
  { value: 'professional', label: 'Professional', description: 'Professional tier organizations' },
  { value: 'enterprise', label: 'Enterprise', description: 'Enterprise tier organizations' },
]

export function EmailBroadcastCard() {
  const supabase = createClient()

  // Form state
  const [emailType, setEmailType] = useState<EmailType>('announcement')
  const [targetTiers, setTargetTiers] = useState<string[]>(['all'])
  const [subject, setSubject] = useState('')
  const [htmlBody, setHtmlBody] = useState('')
  const [tone, setTone] = useState<Tone>('friendly')
  const [aiTopic, setAiTopic] = useState('')
  const [aiKeyPoints, setAiKeyPoints] = useState('')

  // UI state
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [broadcastHistory, setBroadcastHistory] = useState<BroadcastLog[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const getAuthHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')
    return {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    }
  }, [supabase])

  // Fetch recipient count when tiers change
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const headers = await getAuthHeaders()
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/email-broadcast?action=preview`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({ target_tiers: targetTiers }),
          }
        )
        if (res.ok) {
          const data = await res.json()
          setRecipientCount(data.recipient_count)
        }
      } catch {
        setRecipientCount(null)
      }
    }
    fetchCount()
  }, [targetTiers, getAuthHeaders])

  // Toggle tier selection
  const toggleTier = (tier: string) => {
    if (tier === 'all') {
      setTargetTiers(['all'])
      return
    }
    // Remove 'all' if selecting specific tiers
    const withoutAll = targetTiers.filter((t) => t !== 'all')
    if (withoutAll.includes(tier)) {
      const newTiers = withoutAll.filter((t) => t !== tier)
      setTargetTiers(newTiers.length === 0 ? ['all'] : newTiers)
    } else {
      setTargetTiers([...withoutAll, tier])
    }
  }

  // Generate AI draft
  const handleAIDraft = async () => {
    if (!aiTopic.trim()) {
      toast.error('Please enter a topic for the AI to write about')
      return
    }

    setIsGenerating(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/email-broadcast?action=ai-draft`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            email_type: emailType,
            topic: aiTopic.trim(),
            key_points: aiKeyPoints.trim() || undefined,
            tone,
          }),
        }
      )

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'AI draft generation failed')
      }

      const data = await res.json()
      setSubject(data.subject || '')
      setHtmlBody(data.html || '')
      toast.success('AI draft generated — review and edit before sending')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate AI draft')
    } finally {
      setIsGenerating(false)
    }
  }

  // Send broadcast
  const handleSend = async () => {
    if (!subject.trim() || !htmlBody.trim()) {
      toast.error('Subject and email body are required')
      return
    }

    setIsSending(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/email-broadcast?action=send`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            subject: subject.trim(),
            html: htmlBody.trim(),
            email_type: emailType,
            target_tiers: targetTiers,
          }),
        }
      )

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Broadcast failed')
      }

      const data = await res.json()
      toast.success(`Broadcast sent to ${data.sent} recipients`)

      if (data.failed > 0) {
        toast.warning(`${data.failed} emails failed to send`)
      }

      // Reset form
      setSubject('')
      setHtmlBody('')
      setAiTopic('')
      setAiKeyPoints('')
      setShowConfirmDialog(false)

      // Refresh history
      fetchHistory()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Broadcast failed')
    } finally {
      setIsSending(false)
    }
  }

  // Fetch broadcast history
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/email-broadcast?action=history`,
        { headers }
      )
      if (res.ok) {
        const data = await res.json()
        setBroadcastHistory(data.data || [])
      }
    } catch {
      // Silent fail for history
    } finally {
      setLoadingHistory(false)
    }
  }, [getAuthHeaders])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  return (
    <div className="space-y-6">
      {/* Main Compose Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Broadcast
          </CardTitle>
          <CardDescription>
            Send platform-wide emails to users by subscription tier. Use AI to
            help draft professional communications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Row 1: Email Type + Tone */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Email Type</Label>
              <Select value={emailType} onValueChange={(v) => setEmailType(v as EmailType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EMAIL_TYPE_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        {config.icon}
                        <span>{config.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {EMAIL_TYPE_CONFIG[emailType].description}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Tone</Label>
              <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="formal">Formal</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Target Tiers */}
          <div className="space-y-2">
            <Label>Target Audience</Label>
            <div className="flex flex-wrap gap-3">
              {TIER_OPTIONS.map((tier) => (
                <label
                  key={tier.value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 transition-colors hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <Checkbox
                    checked={targetTiers.includes(tier.value)}
                    onCheckedChange={() => toggleTier(tier.value)}
                  />
                  <div>
                    <p className="text-sm font-medium">{tier.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {tier.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
            {recipientCount !== null && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>
                  {recipientCount} recipient{recipientCount !== 1 ? 's' : ''}{' '}
                  will receive this email
                </span>
              </div>
            )}
          </div>

          {/* AI Drafting Section */}
          <Card className="border-dashed border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Email Assistant
              </CardTitle>
              <CardDescription>
                Describe what you want to communicate and AI will draft the email
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="ai-topic">Topic / What to announce</Label>
                <Input
                  id="ai-topic"
                  placeholder="e.g., New battery monitoring feature, Scheduled maintenance on March 5th..."
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-points">
                  Key points to include{' '}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="ai-points"
                  placeholder="e.g., Downtime from 2-4am UTC, No data loss expected, Contact support for questions..."
                  value={aiKeyPoints}
                  onChange={(e) => setAiKeyPoints(e.target.value)}
                  rows={3}
                />
              </div>
              <Button
                onClick={handleAIDraft}
                disabled={isGenerating || !aiTopic.trim()}
                className="w-full sm:w-auto"
              >
                {isGenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {isGenerating ? 'Generating...' : 'Generate Draft'}
              </Button>
            </CardContent>
          </Card>

          {/* Subject + Body */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line</Label>
              <Input
                id="subject"
                placeholder="Email subject..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="html-body">Email Body (HTML)</Label>
                {htmlBody.trim() && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPreviewDialog(true)}
                  >
                    <Eye className="mr-1 h-4 w-4" />
                    Preview
                  </Button>
                )}
              </div>
              <Textarea
                id="html-body"
                placeholder="<p>Hello,</p><p>We're excited to share...</p>"
                value={htmlBody}
                onChange={(e) => setHtmlBody(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
            </div>
          </div>

          {/* Send Button */}
          <div className="flex items-center gap-3 border-t pt-4">
            <Button
              onClick={() => setShowConfirmDialog(true)}
              disabled={!subject.trim() || !htmlBody.trim() || isSending}
              size="lg"
            >
              <Send className="mr-2 h-4 w-4" />
              Review & Send
            </Button>
            <p className="text-xs text-muted-foreground">
              This will send to {recipientCount ?? '...'} recipients. Action
              cannot be undone.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Broadcast History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Broadcast History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : broadcastHistory.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No broadcasts sent yet
            </p>
          ) : (
            <div className="space-y-2">
              {broadcastHistory.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Badge
                      variant="outline"
                      className={`flex-shrink-0 text-xs ${EMAIL_TYPE_CONFIG[log.email_type as EmailType]?.color || ''}`}
                    >
                      {EMAIL_TYPE_CONFIG[log.email_type as EmailType]?.label || log.email_type}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {log.subject}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(log.sent_at).toLocaleString()}</span>
                        <span>·</span>
                        <span>{log.target_tiers.join(', ')}</span>
                        {log.error_message && (
                          <>
                            <span>·</span>
                            <span className="text-red-500">{log.error_message}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="ml-2 flex flex-shrink-0 items-center gap-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span>{log.recipient_count}</span>
                    </div>
                    {log.status === 'sent' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              Preview how the email will appear to recipients
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Subject</p>
              <p className="font-medium">{subject}</p>
            </div>
            <div className="max-h-[400px] overflow-y-auto rounded-lg border bg-white p-4 dark:bg-gray-950">
              <div
                dangerouslySetInnerHTML={{ __html: htmlBody }}
                className="prose prose-sm max-w-none dark:prose-invert"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className={EMAIL_TYPE_CONFIG[emailType].color}>
                {EMAIL_TYPE_CONFIG[emailType].label}
              </Badge>
              <span>·</span>
              <span>
                Sending to {targetTiers.join(', ')} ({recipientCount ?? '...'}{' '}
                recipients)
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setShowPreviewDialog(false)
                setShowConfirmDialog(true)
              }}
            >
              <Send className="mr-2 h-4 w-4" />
              Proceed to Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Send Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Confirm Broadcast
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. Please review the details below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Type</span>
              <Badge variant="outline" className={EMAIL_TYPE_CONFIG[emailType].color}>
                {EMAIL_TYPE_CONFIG[emailType].label}
              </Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subject</span>
              <span className="max-w-[250px] truncate font-medium">{subject}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Target Tiers</span>
              <span>{targetTiers.join(', ')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Recipients</span>
              <span className="font-semibold">
                {recipientCount ?? '...'} users
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={isSending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSend}
              disabled={isSending}
            >
              {isSending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {isSending
                ? 'Sending...'
                : `Send to ${recipientCount ?? '...'} Recipients`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
