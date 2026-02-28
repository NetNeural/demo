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
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Key,
  Plus,
  Trash2,
  Copy,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Clock,
  Shield,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { FeatureGate } from '@/components/FeatureGate'

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  scopes: string[]
  rate_limit_per_minute: number
  is_active: boolean
  last_used_at: string | null
  expires_at: string | null
  created_at: string
  revoked_at: string | null
}

interface ApiKeysTabProps {
  organizationId: string
}

export function ApiKeysTab({ organizationId }: ApiKeysTabProps) {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyExpiry, setNewKeyExpiry] = useState<string>('never')
  const [isCreating, setIsCreating] = useState(false)
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const supabase = createClient()

  const fetchKeys = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/api-keys?organization_id=${organizationId}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!res.ok) {
        const err = await res.json()
        if (err.upgrade_required) return // Feature gate will handle this
        throw new Error(err.error || 'Failed to fetch API keys')
      }

      const data = await res.json()
      setKeys(data.data || [])
    } catch (err) {
      console.error('Failed to fetch API keys:', err)
      toast.error('Failed to load API keys')
    } finally {
      setIsLoading(false)
    }
  }, [organizationId, supabase])

  useEffect(() => {
    fetchKeys()
  }, [fetchKeys])

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      toast.error('Please enter a name for the API key')
      return
    }

    setIsCreating(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const expiryMap: Record<string, number | undefined> = {
        never: undefined,
        '30': 30,
        '90': 90,
        '365': 365,
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/api-keys?organization_id=${organizationId}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: newKeyName.trim(),
            scopes: ['read'],
            expires_in_days: expiryMap[newKeyExpiry],
          }),
        }
      )

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create API key')
      }

      const data = await res.json()
      setCreatedKey(data.data?.key || null)
      toast.success('API key created successfully')
      fetchKeys()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create API key')
    } finally {
      setIsCreating(false)
    }
  }

  const handleRevoke = async (keyId: string) => {
    setRevokingId(keyId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/api-keys?organization_id=${organizationId}&key_id=${keyId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      )

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to revoke API key')
      }

      toast.success('API key revoked')
      fetchKeys()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke API key')
    } finally {
      setRevokingId(null)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Failed to copy')
    }
  }

  const activeKeys = keys.filter((k) => k.is_active && !k.revoked_at)
  const revokedKeys = keys.filter((k) => !k.is_active || k.revoked_at)

  return (
    <FeatureGate feature="api_access" showUpgradePrompt>
      <div className="space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  API Keys
                </CardTitle>
                <CardDescription className="mt-1">
                  Manage API keys for programmatic access to your organization&apos;s
                  data. Keys are scoped to this organization.
                </CardDescription>
              </div>
              <Button onClick={() => {
                setNewKeyName('')
                setNewKeyExpiry('never')
                setCreatedKey(null)
                setShowCreateDialog(true)
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Create API Key
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Shield className="h-4 w-4" />
                <span>Organization-scoped</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                <span>Rate limited</span>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <a
                  href="https://docs.netneural.ai/api"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-1 h-3 w-3" />
                  API Docs
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Active Keys */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Active Keys ({activeKeys.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : activeKeys.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No active API keys. Create one to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {activeKeys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{key.name}</p>
                        <Badge variant="outline" className="text-xs">
                          {key.key_prefix}...
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          Scopes: {key.scopes.join(', ')}
                        </span>
                        <span>
                          Rate: {key.rate_limit_per_minute === -1 ? 'Unlimited' : `${key.rate_limit_per_minute}/min`}
                        </span>
                        {key.expires_at && (
                          <span>
                            Expires: {new Date(key.expires_at).toLocaleDateString()}
                          </span>
                        )}
                        {key.last_used_at && (
                          <span>
                            Last used: {new Date(key.last_used_at).toLocaleDateString()}
                          </span>
                        )}
                        <span>
                          Created: {new Date(key.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRevoke(key.id)}
                      disabled={revokingId === key.id}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      {revokingId === key.id ? 'Revoking...' : 'Revoke'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revoked Keys */}
        {revokedKeys.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-muted-foreground">
                Revoked Keys ({revokedKeys.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {revokedKeys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between rounded-lg border border-dashed p-3 opacity-60"
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm line-through">{key.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {key.key_prefix}... · Revoked{' '}
                        {key.revoked_at
                          ? new Date(key.revoked_at).toLocaleDateString()
                          : ''}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      Revoked
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create Key Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={(open) => {
          if (!open) {
            setCreatedKey(null)
          }
          setShowCreateDialog(open)
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {createdKey ? 'API Key Created' : 'Create API Key'}
              </DialogTitle>
              <DialogDescription>
                {createdKey
                  ? 'Copy your API key now. It will not be shown again.'
                  : 'Create a new API key for programmatic access.'}
              </DialogDescription>
            </DialogHeader>

            {createdKey ? (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/50 p-4">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 break-all text-sm font-mono">
                      {createdKey}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(createdKey)}
                    >
                      {copied ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-950/50">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-600" />
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    Store this key securely. For security reasons, it cannot be
                    displayed again after you close this dialog.
                  </p>
                </div>
                <DialogFooter>
                  <Button onClick={() => {
                    setShowCreateDialog(false)
                    setCreatedKey(null)
                  }}>
                    Done
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="key-name">Key Name</Label>
                  <Input
                    id="key-name"
                    placeholder="e.g., Production API Key"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expiration</Label>
                  <Select
                    value={newKeyExpiry}
                    onValueChange={setNewKeyExpiry}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">No expiration</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                      <SelectItem value="365">1 year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={isCreating}>
                    {isCreating ? 'Creating...' : 'Create Key'}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </FeatureGate>
  )
}
