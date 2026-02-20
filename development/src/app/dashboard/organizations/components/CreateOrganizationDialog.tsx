'use client'

import { useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Building2,
  Plus,
  Loader2,
  ScrollText,
  AlertTriangle,
} from 'lucide-react'
import { edgeFunctions } from '@/lib/edge-functions/client'
import type { SubscriptionTier } from '@/types/organization'

interface CreateOrganizationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** If provided, the new org will be created as a child of this parent org */
  parentOrganizationId?: string
  parentOrganizationName?: string
  /** Whether the current user is a super_admin (can set reseller tier) */
  isSuperAdmin?: boolean
  /** Called after successful creation */
  onCreated?: (org: { id: string; name: string; slug: string }) => void
}

const RESELLER_AGREEMENT_TEXT = `NetNeural Reseller Agreement (v1.0)

By accepting this agreement, your organization ("Reseller") agrees to the following terms:

1. AUTHORIZATION: Reseller is authorized to create and manage customer organizations ("Child Organizations") on the NetNeural IoT Platform.

2. RESPONSIBILITIES: Reseller is responsible for first-line support to their customers, accurate billing and invoicing, ensuring customer compliance with NetNeural Terms of Service, and maintaining accurate records of customer organizations.

3. LIMITS: The number of Child Organizations is subject to the limits specified in the reseller agreement. Contact NetNeural to adjust limits.

4. DATA: Reseller may view aggregated data across Child Organizations for management purposes. Individual device data belongs to the respective Child Organization.

5. BILLING: Reseller will be billed according to the agreed billing model (per-org, per-device, or flat rate). Payment terms are Net 30.

6. TERMINATION: Either party may terminate with 90 days written notice. Upon termination, Child Organizations will be migrated to direct NetNeural management.

7. CONFIDENTIALITY: Reseller agrees to maintain confidentiality of customer data and platform credentials.`

export function CreateOrganizationDialog({
  open,
  onOpenChange,
  parentOrganizationId,
  parentOrganizationName,
  isSuperAdmin = false,
  onCreated,
}: CreateOrganizationDialogProps) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [subscriptionTier, setSubscriptionTier] =
    useState<SubscriptionTier>('starter')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Owner account fields
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerFullName, setOwnerFullName] = useState('')
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true)

  // Reseller agreement state (only for setting reseller tier)
  const [showAgreement, setShowAgreement] = useState(false)
  const [agreementAccepted, setAgreementAccepted] = useState(false)

  const isChildOrg = !!parentOrganizationId

  // Auto-generate slug from name
  const handleNameChange = useCallback((value: string) => {
    setName(value)
    // Only auto-generate slug if user hasn't manually edited it
    const autoSlug = value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 60)
    setSlug(autoSlug)
  }, [])

  const handleTierChange = useCallback((tier: SubscriptionTier) => {
    setSubscriptionTier(tier)
    // Show reseller agreement when selecting reseller/enterprise
    if (tier === 'reseller' || tier === 'enterprise') {
      setShowAgreement(true)
      setAgreementAccepted(false)
    } else {
      setShowAgreement(false)
      setAgreementAccepted(false)
    }
  }, [])

  const handleSubmit = async () => {
    setError(null)

    if (!name.trim()) {
      setError('Organization name is required')
      return
    }
    if (!slug.trim()) {
      setError('Organization slug is required')
      return
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      setError('Slug can only contain lowercase letters, numbers, and hyphens')
      return
    }
    // Validate owner fields if provided
    if (ownerEmail || ownerFullName) {
      if (!ownerEmail || !ownerFullName) {
        setError('Both owner email and full name are required if creating an owner account')
        return
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(ownerEmail)) {
        setError('Invalid email format for owner account')
        return
      }
    }
    // Require agreement acceptance for reseller tier
    if (
      (subscriptionTier === 'reseller' || subscriptionTier === 'enterprise') &&
      !agreementAccepted
    ) {
      setError(
        'You must accept the Reseller Agreement to create a reseller organization'
      )
      return
    }

    setIsSubmitting(true)
    try {
      const response = await edgeFunctions.organizations.create({
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
        subscriptionTier: isChildOrg ? 'starter' : subscriptionTier,
        parentOrganizationId: parentOrganizationId || undefined,
        ...(ownerEmail && ownerFullName ? {
          ownerEmail: ownerEmail.trim(),
          ownerFullName: ownerFullName.trim(),
          sendWelcomeEmail,
        } : {}),
      })

      if (!response.success) {
        const errMsg =
          typeof response.error === 'string'
            ? response.error
            : (response.error as { message?: string })?.message ||
              'Failed to create organization'
        setError(errMsg)
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newOrg = (response.data as any)?.organization
      if (onCreated && newOrg) {
        onCreated({ id: newOrg.id, name: newOrg.name, slug: newOrg.slug })
      }

      // Reset form
      setName('')
      setSlug('')
      setDescription('')
      setSubscriptionTier('starter')
      setShowAgreement(false)
      setAgreementAccepted(false)
      onOpenChange(false)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const availableTiers: {
    value: SubscriptionTier
    label: string
    description: string
    adminOnly?: boolean
  }[] = [
    {
      value: 'free',
      label: 'Free',
      description: 'Basic access, limited devices',
    },
    {
      value: 'starter',
      label: 'Starter',
      description: 'Standard features, default tier',
    },
    {
      value: 'professional',
      label: 'Professional',
      description: 'Advanced features, priority support',
    },
    {
      value: 'reseller',
      label: 'Reseller',
      description: 'Can create & manage customer organizations',
      adminOnly: true,
    },
    {
      value: 'enterprise',
      label: 'Enterprise',
      description: 'Full platform access, custom terms',
      adminOnly: true,
    },
  ]

  const visibleTiers = isSuperAdmin
    ? availableTiers
    : availableTiers.filter((t) => !t.adminOnly)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isChildOrg ? (
              <>
                <Plus className="h-5 w-5" />
                Create Customer Organization
              </>
            ) : (
              <>
                <Building2 className="h-5 w-5" />
                Create Organization
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isChildOrg
              ? `Create a new customer organization under ${parentOrganizationName}. The new org will be managed through your reseller account.`
              : 'Set up a new organization on the NetNeural platform.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Organization Name */}
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization Name *</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g., Acme Industries"
              disabled={isSubmitting}
            />
          </div>

          {/* Slug */}
          <div className="space-y-2">
            <Label htmlFor="org-slug">URL Slug *</Label>
            <Input
              id="org-slug"
              value={slug}
              onChange={(e) =>
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
              }
              placeholder="e.g., acme-industries"
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Lowercase letters, numbers, and hyphens only
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="org-desc">Description</Label>
            <Input
              id="org-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this organization"
              disabled={isSubmitting}
            />
          </div>

          {/* Owner Account Section */}
          <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Owner Account</span>
              <Badge variant="outline" className="text-xs">Optional</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Create a new owner account for this organization. If left blank, you will be the owner.
            </p>

            {/* Owner Email */}
            <div className="space-y-2">
              <Label htmlFor="owner-email">Owner Email</Label>
              <Input
                id="owner-email"
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="owner@example.com"
                disabled={isSubmitting}
              />
            </div>

            {/* Owner Full Name */}
            <div className="space-y-2">
              <Label htmlFor="owner-name">Owner Full Name</Label>
              <Input
                id="owner-name"
                value={ownerFullName}
                onChange={(e) => setOwnerFullName(e.target.value)}
                placeholder="John Doe"
                disabled={isSubmitting}
              />
            </div>

            {/* Send Welcome Email Checkbox */}
            {ownerEmail && ownerFullName && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send-email"
                  checked={sendWelcomeEmail}
                  onCheckedChange={(checked) => setSendWelcomeEmail(checked as boolean)}
                  disabled={isSubmitting}
                />
                <Label
                  htmlFor="send-email"
                  className="text-sm font-normal cursor-pointer"
                >
                  Send welcome email with temporary password
                </Label>
              </div>
            )}
          </div>

          {/* Subscription Tier (not shown for child orgs — they inherit starter) */}
          {!isChildOrg && (
            <div className="space-y-2">
              <Label>Subscription Tier</Label>
              <Select
                value={subscriptionTier}
                onValueChange={(v) => handleTierChange(v as SubscriptionTier)}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {visibleTiers.map((tier) => (
                    <SelectItem key={tier.value} value={tier.value}>
                      <div className="flex items-center gap-2">
                        <span>{tier.label}</span>
                        {tier.adminOnly && (
                          <Badge variant="outline" className="text-xs">
                            Admin
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {
                  availableTiers.find((t) => t.value === subscriptionTier)
                    ?.description
                }
              </p>
            </div>
          )}

          {/* Parent org badge for child orgs */}
          {isChildOrg && parentOrganizationName && (
            <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Parent:</span>
              <Badge variant="secondary">{parentOrganizationName}</Badge>
            </div>
          )}

          {/* Reseller Agreement */}
          {showAgreement && (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center gap-2 text-amber-600">
                <ScrollText className="h-5 w-5" />
                <span className="text-sm font-semibold">
                  Reseller Agreement Required
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded border bg-muted/50 p-3 font-mono text-xs">
                {RESELLER_AGREEMENT_TEXT}
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="agree"
                  checked={agreementAccepted}
                  onCheckedChange={(checked) =>
                    setAgreementAccepted(checked === true)
                  }
                  disabled={isSubmitting}
                />
                <label
                  htmlFor="agree"
                  className="cursor-pointer text-sm leading-tight"
                >
                  I have read and accept the NetNeural Reseller Agreement on
                  behalf of this organization
                </label>
              </div>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              !name.trim() ||
              !slug.trim() ||
              ((subscriptionTier === 'reseller' ||
                subscriptionTier === 'enterprise') &&
                !agreementAccepted)
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                {isChildOrg ? 'Create Customer Org' : 'Create Organization'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
