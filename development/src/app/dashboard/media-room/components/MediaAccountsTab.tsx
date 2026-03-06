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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Key,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Shield,
  ExternalLink,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  Linkedin,
  Twitter,
  Instagram,
  Globe,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useUser } from '@/contexts/UserContext'

// ─── Types ──────────────────────────────────────────────────────────────────

type Platform =
  | 'twitter'
  | 'linkedin'
  | 'instagram'
  | 'facebook'
  | 'threads'
  | 'bluesky'
  | 'mastodon'
  | 'youtube'

interface MediaAccount {
  id: string
  organization_id: string
  platform: Platform
  display_name: string
  is_active: boolean
  scopes: string[]
  account_id: string | null
  account_url: string | null
  last_used_at: string | null
  last_verified_at: string | null
  connected_by: string | null
  created_at: string
  updated_at: string
  // Encrypted fields are never returned from the DB SELECT
  has_api_key: boolean
  has_api_secret: boolean
  has_access_token: boolean
}

interface PlatformConfig {
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  description: string
  fields: CredentialField[]
  docsUrl: string
}

interface CredentialField {
  key: 'api_key' | 'api_secret' | 'access_token' | 'refresh_token'
  label: string
  placeholder: string
  required: boolean
}

const PLATFORM_CONFIG: Record<Platform, PlatformConfig> = {
  twitter: {
    label: 'X (Twitter)',
    icon: Twitter,
    color: 'text-sky-500',
    description: 'Post tweets and threads via the X API v2',
    fields: [
      { key: 'api_key', label: 'API Key (Client ID)', placeholder: 'Enter your X API key...', required: true },
      { key: 'api_secret', label: 'API Secret', placeholder: 'Enter your X API secret...', required: true },
      { key: 'access_token', label: 'Access Token (Bearer)', placeholder: 'Enter your bearer token...', required: true },
    ],
    docsUrl: 'https://developer.x.com/en/docs/authentication',
  },
  linkedin: {
    label: 'LinkedIn',
    icon: Linkedin,
    color: 'text-blue-600',
    description: 'Share updates on your company LinkedIn page',
    fields: [
      { key: 'api_key', label: 'Client ID', placeholder: 'Enter your LinkedIn app client ID...', required: true },
      { key: 'api_secret', label: 'Client Secret', placeholder: 'Enter your LinkedIn client secret...', required: true },
      { key: 'access_token', label: 'Access Token', placeholder: 'Enter your OAuth2 access token...', required: true },
    ],
    docsUrl: 'https://learn.microsoft.com/en-us/linkedin/shared/authentication/',
  },
  instagram: {
    label: 'Instagram',
    icon: Instagram,
    color: 'text-pink-500',
    description: 'Post to your Instagram business account via Graph API',
    fields: [
      { key: 'api_key', label: 'App ID', placeholder: 'Enter your Facebook App ID...', required: true },
      { key: 'api_secret', label: 'App Secret', placeholder: 'Enter your Facebook App Secret...', required: true },
      { key: 'access_token', label: 'Page Access Token', placeholder: 'Enter your page access token...', required: true },
    ],
    docsUrl: 'https://developers.facebook.com/docs/instagram-api/',
  },
  facebook: {
    label: 'Facebook',
    icon: Globe,
    color: 'text-blue-500',
    description: 'Post to your Facebook page',
    fields: [
      { key: 'api_key', label: 'App ID', placeholder: 'Enter your Facebook App ID...', required: true },
      { key: 'api_secret', label: 'App Secret', placeholder: 'Enter your App Secret...', required: true },
      { key: 'access_token', label: 'Page Access Token', placeholder: 'Enter your page access token...', required: true },
    ],
    docsUrl: 'https://developers.facebook.com/docs/pages-api/',
  },
  threads: {
    label: 'Threads',
    icon: Globe,
    color: 'text-gray-700',
    description: 'Post to Threads via the Meta API',
    fields: [
      { key: 'access_token', label: 'Access Token', placeholder: 'Enter your Threads access token...', required: true },
    ],
    docsUrl: 'https://developers.facebook.com/docs/threads/',
  },
  bluesky: {
    label: 'Bluesky',
    icon: Globe,
    color: 'text-blue-400',
    description: 'Post to your Bluesky account via AT Protocol',
    fields: [
      { key: 'api_key', label: 'Handle', placeholder: 'your-handle.bsky.social', required: true },
      { key: 'access_token', label: 'App Password', placeholder: 'Enter your app password...', required: true },
    ],
    docsUrl: 'https://docs.bsky.app/',
  },
  mastodon: {
    label: 'Mastodon',
    icon: Globe,
    color: 'text-purple-500',
    description: 'Post to your Mastodon instance',
    fields: [
      { key: 'api_key', label: 'Instance URL', placeholder: 'https://mastodon.social', required: true },
      { key: 'access_token', label: 'Access Token', placeholder: 'Enter your access token...', required: true },
    ],
    docsUrl: 'https://docs.joinmastodon.org/client/intro/',
  },
  youtube: {
    label: 'YouTube',
    icon: Globe,
    color: 'text-red-500',
    description: 'Manage your YouTube channel content',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'Enter your YouTube API key...', required: true },
      { key: 'access_token', label: 'OAuth Access Token', placeholder: 'Enter your OAuth token...', required: true },
      { key: 'refresh_token', label: 'Refresh Token', placeholder: 'Enter your refresh token...', required: false },
    ],
    docsUrl: 'https://developers.google.com/youtube/v3/getting-started',
  },
}

// Mask a secret for display: show first 4 and last 4 chars
function maskSecret(value: string): string {
  if (value.length <= 10) return '••••••••'
  return `${value.slice(0, 4)}${'•'.repeat(Math.min(value.length - 8, 20))}${value.slice(-4)}`
}

// ─── Component ──────────────────────────────────────────────────────────────

interface MediaAccountsTabProps {
  organizationId: string
}

export function MediaAccountsTab({ organizationId }: MediaAccountsTabProps) {
  const { isOwner } = useOrganization()
  const { user } = useUser()
  const isAdmin = isOwner || user?.isSuperAdmin
  const supabase = createClient()

  const [accounts, setAccounts] = useState<MediaAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showConnectDialog, setShowConnectDialog] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('twitter')
  const [credentials, setCredentials] = useState<Record<string, string>>({})
  const [displayName, setDisplayName] = useState('')
  const [accountUrl, setAccountUrl] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null)
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false)
  const [accountToDisconnect, setAccountToDisconnect] = useState<MediaAccount | null>(null)
  const [revealedFields, setRevealedFields] = useState<Set<string>>(new Set())
  const [editingAccount, setEditingAccount] = useState<MediaAccount | null>(null)

  // ─── Fetch accounts ─────────────────────────────────────────────────────
  const fetchAccounts = useCallback(async () => {
    setIsLoading(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('organization_media_accounts')
        .select(
          'id, organization_id, platform, display_name, is_active, scopes, account_id, account_url, last_used_at, last_verified_at, connected_by, created_at, updated_at, encrypted_api_key, encrypted_api_secret, encrypted_access_token'
        )
        .eq('organization_id', organizationId)
        .order('platform')

      if (error) throw error

      // Map to safe shape — strip encrypted values, only flag their existence
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: MediaAccount[] = (data || []).map((row: any) => ({
        id: row.id,
        organization_id: row.organization_id,
        platform: row.platform as Platform,
        display_name: row.display_name,
        is_active: row.is_active,
        scopes: row.scopes || [],
        account_id: row.account_id,
        account_url: row.account_url,
        last_used_at: row.last_used_at,
        last_verified_at: row.last_verified_at,
        connected_by: row.connected_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
        has_api_key: !!row.encrypted_api_key,
        has_api_secret: !!row.encrypted_api_secret,
        has_access_token: !!row.encrypted_access_token,
      }))

      setAccounts(mapped)
    } catch (err) {
      console.error('Failed to fetch media accounts:', err)
      toast.error('Failed to load media accounts')
    } finally {
      setIsLoading(false)
    }
  }, [organizationId, supabase])

  useEffect(() => {
    if (organizationId) fetchAccounts()
  }, [organizationId, fetchAccounts])

  // ─── Connect account ───────────────────────────────────────────────────
  const handleConnect = async () => {
    const config = PLATFORM_CONFIG[selectedPlatform]
    const missing = config.fields.filter((f) => f.required && !credentials[f.key]?.trim())
    if (missing.length > 0) {
      toast.error(`Please fill in: ${missing.map((f) => f.label).join(', ')}`)
      return
    }
    if (!displayName.trim()) {
      toast.error('Please enter a display name for this account')
      return
    }

    setIsSaving(true)
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id

      // Build the row — encrypted fields go directly since RLS enforces admin-only writes
      const row: Record<string, unknown> = {
        organization_id: organizationId,
        platform: selectedPlatform,
        display_name: displayName.trim(),
        is_active: true,
        account_url: accountUrl.trim() || null,
        connected_by: userId,
        last_verified_at: new Date().toISOString(),
      }

      // Map credential fields to encrypted columns
      if (credentials.api_key) row.encrypted_api_key = credentials.api_key.trim()
      if (credentials.api_secret) row.encrypted_api_secret = credentials.api_secret.trim()
      if (credentials.access_token) row.encrypted_access_token = credentials.access_token.trim()
      if (credentials.refresh_token) row.encrypted_refresh_token = credentials.refresh_token.trim()

      if (editingAccount) {
        // Update existing
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('organization_media_accounts')
          .update(row)
          .eq('id', editingAccount.id)

        if (error) throw error
        toast.success(`${config.label} account updated`)
      } else {
        // Insert new — use upsert to handle one-per-platform constraint
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('organization_media_accounts')
          .upsert(row, { onConflict: 'organization_id,platform' })

        if (error) throw error
        toast.success(`${config.label} account connected`)
      }

      setShowConnectDialog(false)
      resetForm()
      fetchAccounts()
    } catch (err) {
      console.error('Failed to save media account:', err)
      toast.error('Failed to save media account. Make sure you have admin permissions.')
    } finally {
      setIsSaving(false)
    }
  }

  // ─── Disconnect account ────────────────────────────────────────────────
  const handleDisconnect = async () => {
    if (!accountToDisconnect) return
    setDisconnectingId(accountToDisconnect.id)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('organization_media_accounts')
        .delete()
        .eq('id', accountToDisconnect.id)

      if (error) throw error
      toast.success(
        `${PLATFORM_CONFIG[accountToDisconnect.platform]?.label || accountToDisconnect.platform} disconnected`
      )
      fetchAccounts()
    } catch (err) {
      console.error('Failed to disconnect account:', err)
      toast.error('Failed to disconnect account')
    } finally {
      setDisconnectingId(null)
      setShowDisconnectDialog(false)
      setAccountToDisconnect(null)
    }
  }

  // ─── Toggle active ────────────────────────────────────────────────────
  const handleToggleActive = async (account: MediaAccount) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('organization_media_accounts')
        .update({ is_active: !account.is_active })
        .eq('id', account.id)

      if (error) throw error
      toast.success(
        `${PLATFORM_CONFIG[account.platform]?.label} ${account.is_active ? 'disabled' : 'enabled'}`
      )
      fetchAccounts()
    } catch (err) {
      console.error('Failed to toggle account:', err)
      toast.error('Failed to update account')
    }
  }

  // ─── Edit account ─────────────────────────────────────────────────────
  const openEdit = (account: MediaAccount) => {
    setEditingAccount(account)
    setSelectedPlatform(account.platform)
    setDisplayName(account.display_name)
    setAccountUrl(account.account_url || '')
    // Don't pre-fill credentials — user must re-enter to update
    setCredentials({})
    setShowConnectDialog(true)
  }

  const openConnect = () => {
    setEditingAccount(null)
    resetForm()
    setShowConnectDialog(true)
  }

  const resetForm = () => {
    setCredentials({})
    setDisplayName('')
    setAccountUrl('')
    setSelectedPlatform('twitter')
    setEditingAccount(null)
    setRevealedFields(new Set())
  }

  // Filter platforms not yet connected
  const connectedPlatforms = new Set(accounts.map((a) => a.platform))
  const availablePlatforms = (Object.keys(PLATFORM_CONFIG) as Platform[]).filter(
    (p) => !connectedPlatforms.has(p) || editingAccount?.platform === p
  )

  // ─── Render ───────────────────────────────────────────────────────────
  const config = PLATFORM_CONFIG[selectedPlatform]

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-500" />
                Media Account Credentials
              </CardTitle>
              <CardDescription className="mt-1">
                Securely store API keys and access tokens for your social media platforms.
                Credentials are encrypted at rest and only visible to organization admins.
              </CardDescription>
            </div>
            {isAdmin && (
              <Button onClick={openConnect} className="gap-2">
                <Plus className="h-4 w-4" />
                Connect Platform
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Key className="h-12 w-12 text-muted-foreground/30" />
              <h3 className="mt-4 text-lg font-semibold">No platforms connected</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Connect your social media accounts to enable direct posting from
                the Media Room. Your API credentials are encrypted and stored securely.
              </p>
              {isAdmin && (
                <Button onClick={openConnect} className="mt-4 gap-2">
                  <Plus className="h-4 w-4" />
                  Connect Your First Platform
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => {
                const pc = PLATFORM_CONFIG[account.platform]
                if (!pc) return null
                const Icon = pc.icon
                return (
                  <div
                    key={account.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`rounded-lg bg-muted p-2 ${pc.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{pc.label}</span>
                          {account.display_name && (
                            <span className="text-sm text-muted-foreground">
                              ({account.display_name})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {account.has_api_key && (
                            <span className="flex items-center gap-1">
                              <Key className="h-3 w-3" /> API Key
                            </span>
                          )}
                          {account.has_access_token && (
                            <span className="flex items-center gap-1">
                              <Shield className="h-3 w-3" /> Token
                            </span>
                          )}
                          {account.account_url && (
                            <a
                              href={account.account_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 hover:text-foreground"
                            >
                              <ExternalLink className="h-3 w-3" /> Profile
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {account.is_active ? (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Connected
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-muted-foreground">
                          <XCircle className="mr-1 h-3 w-3" /> Disabled
                        </Badge>
                      )}
                      {isAdmin && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(account)}
                            title={account.is_active ? 'Disable' : 'Enable'}
                          >
                            {account.is_active ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(account)}
                            title="Edit credentials"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setAccountToDisconnect(account)
                              setShowDisconnectDialog(true)
                            }}
                            title="Disconnect"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security info */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
        <CardContent className="flex items-start gap-3 pt-6">
          <Shield className="mt-0.5 h-5 w-5 text-blue-500" />
          <div>
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Credential Security
            </p>
            <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
              All API keys and tokens are encrypted at rest in the database. Credentials are only
              accessible to organization admins and owners. They are never displayed in plain text
              after initial entry — to update, enter new values.
            </p>
          </div>
        </CardContent>
      </Card>

      {!isAdmin && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
            <div>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                Admin Access Required
              </p>
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Only organization admins and owners can connect, edit, or disconnect
                media accounts. Contact your administrator to manage credentials.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connect / Edit Dialog */}
      <Dialog open={showConnectDialog} onOpenChange={(open) => {
        if (!open) resetForm()
        setShowConnectDialog(open)
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              {editingAccount ? 'Update Credentials' : 'Connect Platform'}
            </DialogTitle>
            <DialogDescription>
              {editingAccount
                ? `Update the API credentials for ${PLATFORM_CONFIG[editingAccount.platform]?.label}. Leave fields blank to keep existing values.`
                : 'Enter your API credentials to connect a social media platform. Credentials are encrypted and stored securely.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Platform selector (only for new connections) */}
            {!editingAccount && (
              <div className="space-y-2">
                <Label>Platform</Label>
                <Select
                  value={selectedPlatform}
                  onValueChange={(v) => {
                    setSelectedPlatform(v as Platform)
                    setCredentials({})
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePlatforms.map((p) => {
                      const pc = PLATFORM_CONFIG[p]
                      const Icon = pc.icon
                      return (
                        <SelectItem key={p} value={p}>
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${pc.color}`} />
                            <span>{pc.label}</span>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{config.description}</p>
              </div>
            )}

            {/* Display name */}
            <div className="space-y-2">
              <Label htmlFor="display-name">Display Name</Label>
              <Input
                id="display-name"
                placeholder={`e.g. @${organizationId ? 'YourCompany' : 'NetNeural'}`}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                A friendly name to identify this account (e.g. your handle or page name)
              </p>
            </div>

            {/* Account URL */}
            <div className="space-y-2">
              <Label htmlFor="account-url">Profile URL (optional)</Label>
              <Input
                id="account-url"
                placeholder="https://twitter.com/YourCompany"
                value={accountUrl}
                onChange={(e) => setAccountUrl(e.target.value)}
              />
            </div>

            {/* Credential fields */}
            <div className="space-y-3 rounded-lg border border-dashed border-amber-300 bg-amber-50/30 p-4 dark:border-amber-700 dark:bg-amber-950/10">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
                <Shield className="h-4 w-4" />
                API Credentials (encrypted)
              </div>
              {config.fields.map((field) => {
                const fieldId = `cred-${field.key}`
                const isRevealed = revealedFields.has(field.key)
                return (
                  <div key={field.key} className="space-y-1">
                    <Label htmlFor={fieldId} className="text-xs">
                      {field.label}
                      {field.required && !editingAccount && (
                        <span className="text-destructive"> *</span>
                      )}
                    </Label>
                    <div className="relative">
                      <Input
                        id={fieldId}
                        type={isRevealed ? 'text' : 'password'}
                        placeholder={
                          editingAccount
                            ? '(leave blank to keep current)'
                            : field.placeholder
                        }
                        value={credentials[field.key] || ''}
                        onChange={(e) =>
                          setCredentials((prev) => ({
                            ...prev,
                            [field.key]: e.target.value,
                          }))
                        }
                        className="pr-10 font-mono text-sm"
                        autoComplete="off"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                        onClick={() =>
                          setRevealedFields((prev) => {
                            const next = new Set(prev)
                            if (next.has(field.key)) next.delete(field.key)
                            else next.add(field.key)
                            return next
                          })
                        }
                      >
                        {isRevealed ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Docs link */}
            <a
              href={config.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              <ExternalLink className="h-3 w-3" />
              {config.label} API Documentation
            </a>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowConnectDialog(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleConnect} disabled={isSaving} className="gap-2">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingAccount ? 'Update Credentials' : 'Connect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect confirmation */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {accountToDisconnect ? PLATFORM_CONFIG[accountToDisconnect.platform]?.label : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all stored credentials for this platform.
              You&apos;ll need to re-enter your API keys to reconnect. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!!disconnectingId}
            >
              {disconnectingId ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
