'use client'

/**
 * Developer Settings Tab (#391)
 * Combines API Key management and Webhook Subscription management.
 */

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
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Key,
  Webhook,
  Plus,
  Trash2,
  Copy,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Code,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useOrganization } from '@/contexts/OrganizationContext'
import { ApiKeysTab } from '../../organizations/components/ApiKeysTab'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

const SUPPORTED_EVENTS = [
  { value: 'alert.created',  label: 'Alert Created',   description: 'Fires when a new alert is triggered' },
  { value: 'alert.resolved', label: 'Alert Resolved',  description: 'Fires when an alert is resolved' },
  { value: 'device.online',  label: 'Device Online',   description: 'Fires when a device comes online' },
  { value: 'device.offline', label: 'Device Offline',  description: 'Fires when a device goes offline' },
  { value: 'device.warning', label: 'Device Warning',  description: 'Fires when a device enters warning state' },
]

interface WebhookSubscription {
  id: string
  name: string
  url: string
  event_types: string[]
  is_active: boolean
  last_triggered_at: string | null
  last_status_code: number | null
  failure_count: number
  created_at: string
}

// ── Webhook Subscriptions Section ────────────────────────────────────────────

function WebhookSubscriptionsSection({ organizationId }: { organizationId: string }) {
  const supabase = createClient()
  const [subs, setSubs] = useState<WebhookSubscription[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [newName, setNewName] = useState('')
  const [newEvents, setNewEvents] = useState<string[]>(['alert.created'])
  const [isCreating, setIsCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [createdSecret, setCreatedSecret] = useState<string | null>(null)
  const [copiedSecret, setCopiedSecret] = useState(false)

  const authHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      Authorization: `Bearer ${session?.access_token ?? ''}`,
      'Content-Type': 'application/json',
    }
  }, [supabase])

  const fetchSubs = useCallback(async () => {
    setIsLoading(true)
    try {
      const headers = await authHeaders()
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/webhook-subscriptions?organization_id=${organizationId}`,
        { headers }
      )
      if (!res.ok) throw new Error('Failed to fetch webhooks')
      const data = await res.json()
      setSubs(data.subscriptions || [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load webhook subscriptions')
    } finally {
      setIsLoading(false)
    }
  }, [organizationId, authHeaders])

  useEffect(() => { fetchSubs() }, [fetchSubs])

  const handleCreate = async () => {
    if (!newUrl.trim()) { toast.error('Webhook URL is required'); return }
    if (!newUrl.startsWith('https://')) { toast.error('Webhook URL must use HTTPS'); return }
    if (newEvents.length === 0) { toast.error('Select at least one event type'); return }

    setIsCreating(true)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${SUPABASE_URL}/functions/v1/webhook-subscriptions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          organization_id: organizationId,
          name: newName || newUrl,
          url: newUrl,
          event_types: newEvents,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create webhook')
      }
      const data = await res.json()
      setCreatedSecret(data.subscription?.secret || null)
      setNewUrl('')
      setNewName('')
      setNewEvents(['alert.created'])
      setShowCreate(false)
      await fetchSubs()
      toast.success('Webhook subscription created — save the secret below!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create webhook')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const headers = await authHeaders()
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/webhook-subscriptions?id=${id}`,
        { method: 'DELETE', headers }
      )
      if (!res.ok) throw new Error('Failed to delete webhook')
      await fetchSubs()
      toast.success('Webhook subscription deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete webhook')
    } finally {
      setDeletingId(null)
    }
  }

  const handleTest = async (id: string) => {
    setTestingId(id)
    try {
      const headers = await authHeaders()
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/webhook-subscriptions?id=${id}&action=test`,
        { method: 'POST', headers }
      )
      if (!res.ok) throw new Error('Test ping failed')
      toast.success('Test ping sent! Check your endpoint.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test ping failed')
    } finally {
      setTestingId(null)
    }
  }

  const toggleEvent = (event: string) => {
    setNewEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    )
  }

  const copySecret = () => {
    if (createdSecret) {
      navigator.clipboard.writeText(createdSecret)
      setCopiedSecret(true)
      setTimeout(() => setCopiedSecret(false), 2000)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Webhook Subscriptions</CardTitle>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Webhook
          </Button>
        </div>
        <CardDescription>
          Receive real-time HTTP POST notifications when events occur in your organisation.
          Payloads are signed with HMAC-SHA256 via the <code>X-NetNeural-Signature</code> header.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading webhooks…</p>
        ) : subs.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <Webhook className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">No webhook subscriptions yet.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" /> Create your first webhook
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {subs.map(sub => (
              <div key={sub.id} className="flex items-start justify-between rounded-lg border p-4">
                <div className="space-y-1 min-w-0 flex-1 mr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{sub.name}</span>
                    <Badge variant={sub.is_active ? 'default' : 'secondary'} className="shrink-0">
                      {sub.is_active ? 'Active' : 'Paused'}
                    </Badge>
                    {sub.failure_count > 0 && (
                      <Badge variant="destructive" className="shrink-0">
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        {sub.failure_count} failure{sub.failure_count !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono truncate">{sub.url}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {sub.event_types.map(e => (
                      <Badge key={e} variant="outline" className="text-xs">{e}</Badge>
                    ))}
                  </div>
                  {sub.last_triggered_at && (
                    <p className="text-xs text-muted-foreground">
                      Last triggered: {new Date(sub.last_triggered_at).toLocaleString()}
                      {sub.last_status_code ? ` (HTTP ${sub.last_status_code})` : ''}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="outline" size="sm"
                    onClick={() => handleTest(sub.id)}
                    disabled={testingId === sub.id}
                  >
                    <Send className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => handleDelete(sub.id)}
                    disabled={deletingId === sub.id}
                    className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Webhook Subscription</DialogTitle>
            <DialogDescription>
              NetNeural will POST a signed JSON payload to your URL when the selected events occur.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Display Name <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                placeholder="My webhook"
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Endpoint URL <span className="text-destructive">*</span></Label>
              <Input
                placeholder="https://your-server.com/webhook"
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                type="url"
              />
            </div>
            <div className="space-y-2">
              <Label>Events to subscribe to <span className="text-destructive">*</span></Label>
              <div className="space-y-2 rounded-lg border p-3">
                {SUPPORTED_EVENTS.map(ev => (
                  <div key={ev.value} className="flex items-start gap-3">
                    <Checkbox
                      id={`ev-${ev.value}`}
                      checked={newEvents.includes(ev.value)}
                      onCheckedChange={() => toggleEvent(ev.value)}
                    />
                    <label htmlFor={`ev-${ev.value}`} className="space-y-0.5 cursor-pointer">
                      <p className="text-sm font-medium leading-none">{ev.label}</p>
                      <p className="text-xs text-muted-foreground">{ev.description}</p>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? 'Creating…' : 'Create Webhook'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Secret reveal dialog — shown once after creation */}
      <Dialog open={!!createdSecret} onOpenChange={() => setCreatedSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Webhook Created — Save Your Secret
            </DialogTitle>
            <DialogDescription>
              This signing secret is shown <strong>only once</strong>. Use it to verify
              incoming webhook payloads via the <code>X-NetNeural-Signature</code> header.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-muted p-3 font-mono text-sm break-all">
            {createdSecret}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={copySecret}>
              {copiedSecret ? <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" /> : <Copy className="mr-2 h-4 w-4" />}
              {copiedSecret ? 'Copied!' : 'Copy Secret'}
            </Button>
            <Button onClick={() => setCreatedSecret(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// ── Main DeveloperTab ─────────────────────────────────────────────────────────

export function DeveloperTab() {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id

  if (!orgId) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground">
        <p>Select an organization to manage developer credentials.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* API Keys */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Key className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-base font-semibold">API Keys</h3>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Use authenticated API keys to pull data from the{' '}
          <a
            href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/export/openapi`}
            className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
            target="_blank"
            rel="noopener noreferrer"
          >
            Export API <ExternalLink className="h-3 w-3" />
          </a>
          .{' '}
          Rate limits and scopes apply per key.
        </p>
        <ApiKeysTab organizationId={orgId} />
      </div>

      {/* Webhook Subscriptions */}
      <div>
        <WebhookSubscriptionsSection organizationId={orgId} />
      </div>

      {/* API Reference link */}
      <Card className="bg-muted/50">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Export API Reference</span>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a
                href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/export/openapi`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Swagger UI <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Interactive API docs with try-it-out for all export endpoints. Supports CSV export,
            keyset pagination, and rate-limited access.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
