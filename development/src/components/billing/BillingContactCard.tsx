'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import {
  Building2,
  Mail,
  MapPin,
  Pencil,
  Save,
  X,
  AlertTriangle,
  Receipt,
} from 'lucide-react'

let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) _supabase = createClient()
  return _supabase
}

interface BillingProfile {
  id: string
  billing_name: string | null
  billing_email: string | null
  company_name: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string | null
  tax_id: string | null
  tax_id_type: string | null
}

type EditableProfile = Omit<BillingProfile, 'id'>

interface BillingContactCardProps {
  organizationId: string
}

export function BillingContactCard({ organizationId }: BillingContactCardProps) {
  const [profile, setProfile] = useState<BillingProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<EditableProfile>({
    billing_name: null,
    billing_email: null,
    company_name: null,
    address_line1: null,
    address_line2: null,
    city: null,
    state: null,
    postal_code: null,
    country: 'US',
    tax_id: null,
    tax_id_type: null,
  })

  const fetchProfile = useCallback(async () => {
    if (!organizationId) return
    setLoading(true)
    setError(null)
    try {
      const supabase = getSupabase()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: err } = await (supabase as any)
        .from('customer_billing_profiles')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (err) throw err
      if (data) {
        setProfile(data as BillingProfile)
        setDraft({
          billing_name: data.billing_name,
          billing_email: data.billing_email,
          company_name: data.company_name,
          address_line1: data.address_line1,
          address_line2: data.address_line2,
          city: data.city,
          state: data.state,
          postal_code: data.postal_code,
          country: data.country ?? 'US',
          tax_id: data.tax_id,
          tax_id_type: data.tax_id_type,
        })
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load billing contact'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const handleSave = async () => {
    setSaving(true)
    try {
      const supabase = getSupabase()
      if (profile) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: err } = await (supabase as any)
          .from('customer_billing_profiles')
          .update(draft)
          .eq('id', profile.id)
        if (err) throw err
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: err } = await (supabase as any)
          .from('customer_billing_profiles')
          .insert({ ...draft, organization_id: organizationId })
        if (err) throw err
      }
      toast.success('Billing contact updated')
      setEditing(false)
      fetchProfile()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save billing contact'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (profile) {
      setDraft({
        billing_name: profile.billing_name,
        billing_email: profile.billing_email,
        company_name: profile.company_name,
        address_line1: profile.address_line1,
        address_line2: profile.address_line2,
        city: profile.city,
        state: profile.state,
        postal_code: profile.postal_code,
        country: profile.country ?? 'US',
        tax_id: profile.tax_id,
        tax_id_type: profile.tax_id_type,
      })
    }
    setEditing(false)
  }

  const field = (key: keyof EditableProfile) =>
    (draft[key] as string | null) ?? ''

  const setField = (key: keyof EditableProfile, value: string) =>
    setDraft((prev) => ({ ...prev, [key]: value || null }))

  const hasAddress = profile?.address_line1 || profile?.city || profile?.postal_code
  const hasContactInfo = profile?.billing_name || profile?.billing_email || profile?.company_name

  return (
    <Card data-testid="billing-contact-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-lg">Billing Contact</CardTitle>
          <CardDescription>Name, email, and address that appear on invoices</CardDescription>
        </div>
        {!editing && (
          <Button
            data-testid="edit-billing-contact-btn"
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-5 w-40" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : editing ? (
          /* ── Edit Form ── */
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="billing_name">Billing Name</Label>
                <Input
                  id="billing_name"
                  data-testid="billing-name-input"
                  placeholder="John Smith"
                  value={field('billing_name')}
                  onChange={(e) => setField('billing_name', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="billing_email">Billing Email</Label>
                <Input
                  id="billing_email"
                  data-testid="billing-email-input"
                  type="email"
                  placeholder="billing@yourcompany.com"
                  value={field('billing_email')}
                  onChange={(e) => setField('billing_email', e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="company_name">Company / Legal Name</Label>
                <Input
                  id="company_name"
                  data-testid="company-name-input"
                  placeholder="Acme Corp LLC"
                  value={field('company_name')}
                  onChange={(e) => setField('company_name', e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="address_line1">Address Line 1</Label>
                <Input
                  id="address_line1"
                  data-testid="address-line1-input"
                  placeholder="123 Main Street"
                  value={field('address_line1')}
                  onChange={(e) => setField('address_line1', e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="address_line2">Address Line 2 (optional)</Label>
                <Input
                  id="address_line2"
                  placeholder="Suite 400"
                  value={field('address_line2')}
                  onChange={(e) => setField('address_line2', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  data-testid="city-input"
                  placeholder="San Francisco"
                  value={field('city')}
                  onChange={(e) => setField('city', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="state">State / Province</Label>
                <Input
                  id="state"
                  placeholder="CA"
                  value={field('state')}
                  onChange={(e) => setField('state', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="postal_code">ZIP / Postal Code</Label>
                <Input
                  id="postal_code"
                  data-testid="postal-code-input"
                  placeholder="94102"
                  value={field('postal_code')}
                  onChange={(e) => setField('postal_code', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  placeholder="US"
                  value={field('country')}
                  onChange={(e) => setField('country', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tax_id">Tax ID / VAT Number (optional)</Label>
                <Input
                  id="tax_id"
                  data-testid="tax-id-input"
                  placeholder="12-3456789"
                  value={field('tax_id')}
                  onChange={(e) => setField('tax_id', e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                data-testid="save-billing-contact-btn"
                size="sm"
                onClick={handleSave}
                disabled={saving}
              >
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
              <Button
                data-testid="cancel-billing-contact-btn"
                size="sm"
                variant="outline"
                onClick={handleCancel}
                disabled={saving}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          /* ── Read View ── */
          <div className="space-y-3">
            {!hasContactInfo && !hasAddress && (
              <div
                data-testid="no-billing-contact"
                className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-5 text-center"
              >
                <Receipt className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">No billing contact set</p>
                  <p className="text-xs text-muted-foreground">
                    Add a name, email, and address to appear on your invoices.
                  </p>
                </div>
                <Button
                  data-testid="add-billing-contact-btn"
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Add Billing Contact
                </Button>
              </div>
            )}

            {(profile?.billing_name || profile?.company_name) && (
              <div className="flex items-start gap-2">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  {profile.billing_name && (
                    <p data-testid="billing-name-display" className="text-sm font-medium">
                      {profile.billing_name}
                    </p>
                  )}
                  {profile.company_name && (
                    <p data-testid="company-name-display" className="text-sm text-muted-foreground">
                      {profile.company_name}
                    </p>
                  )}
                </div>
              </div>
            )}

            {profile?.billing_email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                <p data-testid="billing-email-display" className="text-sm">
                  {profile.billing_email}
                </p>
              </div>
            )}

            {hasAddress && (
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="text-sm">
                  {profile?.address_line1 && (
                    <p data-testid="address-display">{profile.address_line1}</p>
                  )}
                  {profile?.address_line2 && <p>{profile.address_line2}</p>}
                  {(profile?.city || profile?.state || profile?.postal_code) && (
                    <p>
                      {[profile.city, profile.state, profile.postal_code]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  )}
                  {profile?.country && (
                    <p className="text-muted-foreground">{profile.country}</p>
                  )}
                </div>
              </div>
            )}

            {profile?.tax_id && (
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 shrink-0 text-muted-foreground" />
                <p data-testid="tax-id-display" className="text-sm text-muted-foreground">
                  Tax ID: {profile.tax_id}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
