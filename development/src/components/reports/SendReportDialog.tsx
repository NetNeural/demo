'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { Mail, MessageSquare, Send, Search, Users } from 'lucide-react'
import { useOrganization } from '@/contexts/OrganizationContext'
import { edgeFunctions } from '@/lib/edge-functions'
import { toast } from 'sonner'

export interface ReportPayload {
  /** Report title, e.g. "Alert History Report" */
  title: string
  /** CSV content string — will be base64-encoded and attached to email */
  csvContent: string
  /** Short plain-text summary for SMS (max ~300 chars) */
  smsSummary: string
  /** Filename for the CSV attachment */
  csvFilename: string
}

interface OrgMember {
  id: string
  email: string
  full_name: string | null
  role: string
  phone_number?: string | null
  phone_sms_enabled?: boolean
}

type DeliveryChannel = 'email' | 'sms' | 'both'

interface SendReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called to generate the report payload when the user clicks Send */
  getReportPayload: () => ReportPayload
}

export function SendReportDialog({
  open,
  onOpenChange,
  getReportPayload,
}: SendReportDialogProps) {
  const { currentOrganization } = useOrganization()
  const [members, setMembers] = useState<OrgMember[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [channel, setChannel] = useState<DeliveryChannel>('email')
  const [search, setSearch] = useState('')

  // Fetch org members when dialog opens
  const fetchMembers = useCallback(async () => {
    if (!currentOrganization) return
    setLoading(true)
    try {
      const response = await edgeFunctions.members.list(currentOrganization.id)
      if (response.success && response.data) {
        const membersList = (
          (response.data as { members: OrgMember[] }).members || []
        ).map((m) => ({
          id: m.id,
          email: m.email,
          full_name: m.full_name,
          role: m.role,
          phone_number: m.phone_number || null,
          phone_sms_enabled: m.phone_sms_enabled || false,
        }))
        setMembers(membersList)
      }
    } catch (error) {
      console.error('Failed to load members:', error)
      toast.error('Failed to load organization members')
    } finally {
      setLoading(false)
    }
  }, [currentOrganization])

  useEffect(() => {
    if (open) {
      fetchMembers()
      setSelectedIds(new Set())
      setSearch('')
      setChannel('email')
    }
  }, [open, fetchMembers])

  const toggleMember = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === filteredMembers.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredMembers.map((m) => m.id)))
    }
  }

  const filteredMembers = members.filter((m) => {
    const q = search.toLowerCase()
    return (
      (m.full_name?.toLowerCase().includes(q) ?? false) ||
      m.email.toLowerCase().includes(q) ||
      m.role.toLowerCase().includes(q)
    )
  })

  const selectedMembers = members.filter((m) => selectedIds.has(m.id))
  const emailRecipients = selectedMembers.map((m) => m.email)
  const smsRecipients = selectedMembers.filter(
    (m) => m.phone_number && m.phone_sms_enabled
  )

  const canSendEmail =
    (channel === 'email' || channel === 'both') && emailRecipients.length > 0
  const canSendSMS =
    (channel === 'sms' || channel === 'both') && smsRecipients.length > 0
  const canSend =
    selectedIds.size > 0 &&
    ((channel === 'email' && canSendEmail) ||
      (channel === 'sms' && canSendSMS) ||
      (channel === 'both' && (canSendEmail || canSendSMS)))

  const handleSend = async () => {
    if (!currentOrganization || selectedIds.size === 0) return

    setSending(true)
    try {
      const payload = getReportPayload()

      // Base64-encode CSV for email attachment
      const csvBase64 = btoa(unescape(encodeURIComponent(payload.csvContent)))

      const results: string[] = []

      // Send email
      if (channel === 'email' || channel === 'both') {
        if (emailRecipients.length > 0) {
          const emailResponse = await edgeFunctions.call('send-email', {
            method: 'POST',
            body: {
              to: emailRecipients,
              subject: `${payload.title} — ${currentOrganization.name}`,
              html: buildEmailHtml(
                payload.title,
                currentOrganization.name,
                payload.smsSummary,
                payload.csvFilename
              ),
              text: `${payload.title} for ${currentOrganization.name}\n\n${payload.smsSummary}\n\nThe full report is attached as a CSV file.`,
              attachments: [
                {
                  filename: payload.csvFilename,
                  content: csvBase64,
                },
              ],
            },
          })
          if (emailResponse.success) {
            results.push(`Email sent to ${emailRecipients.length} recipient(s)`)
          } else {
            throw new Error(String(emailResponse.error || 'Email send failed'))
          }
        }
      }

      // Send SMS
      if (channel === 'sms' || channel === 'both') {
        if (smsRecipients.length > 0) {
          const smsResponse = await edgeFunctions.call('send-report-sms', {
            method: 'POST',
            body: {
              organization_id: currentOrganization.id,
              phone_numbers: smsRecipients.map((m) => m.phone_number),
              message: `[${currentOrganization.name}] ${payload.title}\n\n${payload.smsSummary}`,
            },
          })
          if (smsResponse.success) {
            results.push(`SMS sent to ${smsRecipients.length} recipient(s)`)
          } else {
            throw new Error(String(smsResponse.error || 'SMS send failed'))
          }
        }
      }

      toast.success(results.join('. ') || 'Report sent!')
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to send report:', error)
      toast.error(
        `Failed to send report: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Report
          </DialogTitle>
          <DialogDescription>
            Choose organization members to receive this report via email or SMS.
          </DialogDescription>
        </DialogHeader>

        {/* Delivery Channel */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Delivery Channel</label>
          <div className="flex gap-2">
            {(
              [
                {
                  value: 'email' as DeliveryChannel,
                  label: 'Email',
                  icon: Mail,
                },
                {
                  value: 'sms' as DeliveryChannel,
                  label: 'SMS',
                  icon: MessageSquare,
                },
                {
                  value: 'both' as DeliveryChannel,
                  label: 'Both',
                  icon: Users,
                },
              ] as const
            ).map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                variant={channel === value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChannel(value)}
                className="flex-1"
              >
                <Icon className="mr-2 h-4 w-4" />
                {label}
              </Button>
            ))}
          </div>
          {(channel === 'sms' || channel === 'both') && (
            <p className="text-xs text-muted-foreground">
              SMS sends a text summary only. Only members with SMS enabled and a
              phone number on file will receive texts.
            </p>
          )}
        </div>

        {/* Member Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Select All / Clear */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={toggleAll}
            className="text-sm text-primary hover:underline"
          >
            {selectedIds.size === filteredMembers.length
              ? 'Deselect All'
              : 'Select All'}
          </button>
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} of {members.length} selected
          </span>
        </div>

        {/* Members List */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : members.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No members found in this organization
          </div>
        ) : (
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-2">
            {filteredMembers.map((member) => {
              const hasSMS = member.phone_number && member.phone_sms_enabled
              return (
                <label
                  key={member.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted"
                >
                  <Checkbox
                    checked={selectedIds.has(member.id)}
                    onCheckedChange={() => toggleMember(member.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {member.full_name || member.email}
                      </span>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {member.role}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{member.email}</span>
                      {hasSMS && (
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          SMS
                        </Badge>
                      )}
                    </div>
                  </div>
                </label>
              )
            })}
          </div>
        )}

        {/* Send Info */}
        {selectedIds.size > 0 && (
          <div className="space-y-1 rounded-md bg-muted/50 p-3 text-sm">
            {(channel === 'email' || channel === 'both') && (
              <p>
                <Mail className="mr-1 inline h-3 w-3" />
                Email with CSV attachment → {emailRecipients.length}{' '}
                recipient(s)
              </p>
            )}
            {(channel === 'sms' || channel === 'both') && (
              <p>
                <MessageSquare className="mr-1 inline h-3 w-3" />
                SMS summary → {smsRecipients.length} recipient(s)
                {smsRecipients.length === 0 && (
                  <span className="text-destructive">
                    {' '}
                    (no members have SMS enabled)
                  </span>
                )}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!canSend || sending}>
            {sending ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin">⏳</span>
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Build a nicely-formatted HTML email body */
function buildEmailHtml(
  title: string,
  orgName: string,
  summary: string,
  filename: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f4f4f5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; margin-top: 20px; margin-bottom: 20px; }
    .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 32px; }
    .header h1 { margin: 0 0 4px; font-size: 20px; font-weight: 600; }
    .header p { margin: 0; opacity: 0.8; font-size: 14px; }
    .body { padding: 32px; }
    .summary { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin-bottom: 24px; font-size: 14px; line-height: 1.6; color: #334155; }
    .attachment-note { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #1e40af; }
    .attachment-note strong { color: #1e3a8a; }
    .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${title}</h1>
      <p>${orgName} &mdash; Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>
    <div class="body">
      <div class="summary">${summary.replace(/\n/g, '<br>')}</div>
      <div class="attachment-note">
        📎 <strong>${filename}</strong> is attached to this email. Open it in Excel, Google Sheets, or any CSV viewer.
      </div>
    </div>
    <div class="footer">
      Sent from NetNeural IoT Platform &mdash; ${orgName}
    </div>
  </div>
</body>
</html>
  `.trim()
}
