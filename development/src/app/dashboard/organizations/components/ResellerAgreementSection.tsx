'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDateFormatter } from '@/hooks/useDateFormatter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ScrollText,
  FileCheck,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Send,
  Building2,
  User,
  Mail,
  Phone,
  Globe,
  Briefcase,
  Users,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { edgeFunctions } from '@/lib/edge-functions/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useUser } from '@/contexts/UserContext';

interface ResellerAgreement {
  id: string;
  status: string;
  agreement_type: string;
  max_child_organizations: number;
  revenue_share_percent: number;
  billing_model: string;
  accepted_at: string | null;
  agreement_version: string;
  effective_date: string | null;
  expiration_date: string | null;
  created_at: string;
}

interface ResellerApplication {
  id: string;
  status: string;
  applicant_name: string;
  applicant_email: string;
  company_legal_name: string;
  estimated_customers: number;
  github_issue_number: number | null;
  github_issue_url: string | null;
  review_notes: string | null;
  created_at: string;
}

interface AgreementStatusResponse {
  agreement: ResellerAgreement | null;
  application: ResellerApplication | null;
}

interface ResellerAgreementSectionProps {
  organizationId: string;
}

export function ResellerAgreementSection({ organizationId }: ResellerAgreementSectionProps) {
  const { currentOrganization, isOwner } = useOrganization();
  const { user } = useUser();
  const { fmt } = useDateFormatter();
  const [agreement, setAgreement] = useState<ResellerAgreement | null>(null);
  const [application, setApplication] = useState<ResellerApplication | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    applicantName: '',
    applicantEmail: '',
    applicantTitle: '',
    applicantPhone: '',
    companyLegalName: '',
    companyAddress: '',
    companyWebsite: '',
    companyTaxId: '',
    estimatedCustomers: 5,
    targetMarket: '',
    businessModel: '',
    preferredBilling: 'per_org',
    additionalNotes: '',
  });

  const fetchStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await edgeFunctions.call<AgreementStatusResponse>(
        'reseller-agreement-apply',
        {
          method: 'GET',
          params: { organizationId },
        }
      );

      if (response.success && response.data) {
        setAgreement(response.data.agreement);
        setApplication(response.data.application);
      }
    } catch (err) {
      console.error('Failed to fetch agreement status:', err);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Pre-fill form with user data when dialog opens
  useEffect(() => {
    if (showApplyDialog && user && currentOrganization) {
      setForm((prev) => ({
        ...prev,
        applicantName: prev.applicantName || '',
        applicantEmail: prev.applicantEmail || user.email || '',
        companyLegalName: prev.companyLegalName || currentOrganization.name || '',
      }));
    }
  }, [showApplyDialog, user, currentOrganization]);

  const handleSubmit = async () => {
    // Validate required fields
    if (!form.applicantName.trim()) {
      toast.error('Please enter your full name');
      return;
    }
    if (!form.applicantEmail.trim()) {
      toast.error('Please enter your email address');
      return;
    }
    if (!form.companyLegalName.trim()) {
      toast.error('Please enter the company legal name');
      return;
    }
    if (!form.companyAddress.trim()) {
      toast.error('Please enter the company address');
      return;
    }
    if (form.estimatedCustomers < 1) {
      toast.error('Estimated customers must be at least 1');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await edgeFunctions.call<{ application: ResellerApplication; message: string }>(
        'reseller-agreement-apply',
        {
          method: 'POST',
          body: {
            organizationId,
            ...form,
          },
        }
      );

      if (response.success) {
        toast.success('Application submitted! Our team will review it shortly.');
        setShowApplyDialog(false);
        await fetchStatus();
      } else {
        toast.error(response.error?.message || 'Failed to submit application');
      }
    } catch (err) {
      console.error('Failed to submit application:', err);
      toast.error('Failed to submit application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'under_review':
        return <FileCheck className="w-4 h-4 text-amber-500" />;
      case 'approved':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'active':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'destructive' | 'outline' | 'secondary'; className?: string }> = {
      submitted: { variant: 'secondary', className: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' },
      under_review: { variant: 'secondary', className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
      approved: { variant: 'default', className: 'bg-green-600' },
      rejected: { variant: 'destructive' },
      active: { variant: 'default', className: 'bg-green-600' },
      pending: { variant: 'outline' },
    };
    const config = variants[status] || { variant: 'outline' as const };
    return (
      <Badge variant={config.variant} className={config.className}>
        {status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // ── Active Agreement Display ──
  if (agreement && agreement.status === 'active') {
    return (
      <Card className="border-green-200 dark:border-green-900">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="w-5 h-5 text-green-600" />
                Reseller Agreement
              </CardTitle>
              <CardDescription>Your active reseller contract with NetNeural</CardDescription>
            </div>
            {getStatusBadge(agreement.status)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Agreement Type</p>
              <p className="font-semibold text-sm capitalize">{agreement.agreement_type}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Max Customer Orgs</p>
              <p className="font-semibold text-sm">{agreement.max_child_organizations}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Billing Model</p>
              <p className="font-semibold text-sm capitalize">
                {agreement.billing_model.replace(/_/g, ' ')}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Version</p>
              <p className="font-semibold text-sm">v{agreement.agreement_version}</p>
            </div>
          </div>
          {(agreement.effective_date || agreement.expiration_date) && (
            <div className="grid gap-4 md:grid-cols-2 mt-4 pt-4 border-t">
              {agreement.effective_date && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Effective Date</p>
                  <p className="text-sm">
                    {fmt.longDate(agreement.effective_date)}
                  </p>
                </div>
              )}
              {agreement.expiration_date && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Expiration Date</p>
                  <p className="text-sm">
                    {fmt.longDate(agreement.expiration_date)}
                  </p>
                </div>
              )}
            </div>
          )}
          {agreement.accepted_at && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Agreement accepted on{' '}
                {fmt.longDate(agreement.accepted_at)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── Pending Application Display ──
  if (application && ['submitted', 'under_review'].includes(application.status)) {
    return (
      <Card className="border-blue-200 dark:border-blue-900">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="w-5 h-5 text-blue-600" />
                Reseller Agreement Application
              </CardTitle>
              <CardDescription>Your application is being reviewed</CardDescription>
            </div>
            {getStatusBadge(application.status)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-blue-700 dark:text-blue-400">Application Under Review</p>
                <p className="text-muted-foreground mt-1">
                  Your reseller agreement application for <strong>{application.company_legal_name}</strong> was
                  submitted on {fmt.longDate(application.created_at)}. Our team is reviewing your application and will notify you once a decision has been made.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Applicant</p>
                <p className="font-semibold text-sm">{application.applicant_name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Company</p>
                <p className="font-semibold text-sm">{application.company_legal_name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Est. Customers</p>
                <p className="font-semibold text-sm">{application.estimated_customers}</p>
              </div>
            </div>

            {application.github_issue_url && (
              <div className="pt-2 border-t">
                <a
                  href={application.github_issue_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Track application progress
                </a>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Rejected Application (allow re-apply) ──
  if (application && application.status === 'rejected') {
    return (
      <Card className="border-red-200 dark:border-red-900">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="w-5 h-5 text-red-600" />
                Reseller Agreement
              </CardTitle>
              <CardDescription>Application status</CardDescription>
            </div>
            {getStatusBadge('rejected')}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-red-700 dark:text-red-400">Application Not Approved</p>
                <p className="text-muted-foreground mt-1">
                  {application.review_notes || 'Your application was not approved at this time. You may submit a new application if your circumstances have changed.'}
                </p>
              </div>
            </div>
            {isOwner && (
              <Button onClick={() => setShowApplyDialog(true)} variant="outline">
                <Send className="w-4 h-4 mr-2" />
                Submit New Application
              </Button>
            )}
          </div>
        </CardContent>

        {/* Application Dialog */}
        <ApplicationDialog
          open={showApplyDialog}
          onOpenChange={setShowApplyDialog}
          form={form}
          setForm={setForm}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      </Card>
    );
  }

  // ── No Agreement - Show Apply Button ──
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="w-5 h-5" />
              Reseller Agreement
            </CardTitle>
            <CardDescription>Become a NetNeural authorized reseller</CardDescription>
          </div>
          <Badge variant="outline">No Agreement</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">No reseller agreement on file</p>
              <p className="text-muted-foreground mt-1">
                Apply for a reseller agreement to create and manage customer organizations, access wholesale pricing, and grow your IoT business with NetNeural.
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3 text-sm">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30">
              <Building2 className="w-4 h-4 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Manage Customer Orgs</p>
                <p className="text-xs text-muted-foreground">Create and oversee customer organizations</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30">
              <Users className="w-4 h-4 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Wholesale Pricing</p>
                <p className="text-xs text-muted-foreground">Access reseller pricing and revenue sharing</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30">
              <Briefcase className="w-4 h-4 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Dedicated Support</p>
                <p className="text-xs text-muted-foreground">Priority reseller support channel</p>
              </div>
            </div>
          </div>

          {isOwner ? (
            <Button onClick={() => setShowApplyDialog(true)} className="w-full sm:w-auto">
              <Send className="w-4 h-4 mr-2" />
              Apply for a Reseller Agreement
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Only organization owners can apply for reseller agreements.
            </p>
          )}
        </div>
      </CardContent>

      {/* Application Dialog */}
      <ApplicationDialog
        open={showApplyDialog}
        onOpenChange={setShowApplyDialog}
        form={form}
        setForm={setForm}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </Card>
  );
}

// ─────────────────────────────────────────────────────────
// Application Form Dialog
// ─────────────────────────────────────────────────────────

interface ApplicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: {
    applicantName: string;
    applicantEmail: string;
    applicantTitle: string;
    applicantPhone: string;
    companyLegalName: string;
    companyAddress: string;
    companyWebsite: string;
    companyTaxId: string;
    estimatedCustomers: number;
    targetMarket: string;
    businessModel: string;
    preferredBilling: string;
    additionalNotes: string;
  };
  setForm: React.Dispatch<React.SetStateAction<ApplicationDialogProps['form']>>;
  onSubmit: () => Promise<void>;
  isSubmitting: boolean;
}

function ApplicationDialog({ open, onOpenChange, form, setForm, onSubmit, isSubmitting }: ApplicationDialogProps) {
  const update = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="w-5 h-5" />
            Reseller Agreement Application
          </DialogTitle>
          <DialogDescription>
            Fill out this form to apply for a NetNeural reseller agreement. Our team will review your
            application and get back to you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Section: Applicant Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4" />
              Applicant Information
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="applicantName">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="applicantName"
                  value={form.applicantName}
                  onChange={(e) => update('applicantName', e.target.value)}
                  placeholder="John Smith"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="applicantEmail">
                  Email <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="applicantEmail"
                    type="email"
                    value={form.applicantEmail}
                    onChange={(e) => update('applicantEmail', e.target.value)}
                    placeholder="john@company.com"
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="applicantTitle">Job Title</Label>
                <Input
                  id="applicantTitle"
                  value={form.applicantTitle}
                  onChange={(e) => update('applicantTitle', e.target.value)}
                  placeholder="VP of Operations"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="applicantPhone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="applicantPhone"
                    type="tel"
                    value={form.applicantPhone}
                    onChange={(e) => update('applicantPhone', e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section: Company Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Company Details
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="companyLegalName">
                  Legal Company Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="companyLegalName"
                  value={form.companyLegalName}
                  onChange={(e) => update('companyLegalName', e.target.value)}
                  placeholder="Acme IoT Solutions, Inc."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyWebsite">Company Website</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="companyWebsite"
                    type="url"
                    value={form.companyWebsite}
                    onChange={(e) => update('companyWebsite', e.target.value)}
                    placeholder="https://company.com"
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyAddress">
                Company Address <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="companyAddress"
                value={form.companyAddress}
                onChange={(e) => update('companyAddress', e.target.value)}
                placeholder="123 Business Ave, Suite 100&#10;City, State 12345, Country"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyTaxId">Tax ID / EIN (optional)</Label>
              <Input
                id="companyTaxId"
                value={form.companyTaxId}
                onChange={(e) => update('companyTaxId', e.target.value)}
                placeholder="XX-XXXXXXX"
              />
            </div>
          </div>

          {/* Section: Business Case */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Business Case
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="estimatedCustomers">
                  Estimated Number of Customers <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="estimatedCustomers"
                  type="number"
                  min={1}
                  value={form.estimatedCustomers}
                  onChange={(e) => update('estimatedCustomers', parseInt(e.target.value, 10) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferredBilling">Preferred Billing Model</Label>
                <Select
                  value={form.preferredBilling}
                  onValueChange={(value) => update('preferredBilling', value)}
                >
                  <SelectTrigger id="preferredBilling">
                    <SelectValue placeholder="Select billing model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_org">Per Organization</SelectItem>
                    <SelectItem value="per_device">Per Device</SelectItem>
                    <SelectItem value="flat_rate">Flat Rate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetMarket">Target Market / Vertical</Label>
              <Input
                id="targetMarket"
                value={form.targetMarket}
                onChange={(e) => update('targetMarket', e.target.value)}
                placeholder="e.g., Smart agriculture, industrial monitoring, fleet management"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessModel">Describe Your Reseller Business Model</Label>
              <Textarea
                id="businessModel"
                value={form.businessModel}
                onChange={(e) => update('businessModel', e.target.value)}
                placeholder="How do you plan to resell NetNeural IoT services to your customers? What value-added services will you provide?"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="additionalNotes">Additional Notes</Label>
              <Textarea
                id="additionalNotes"
                value={form.additionalNotes}
                onChange={(e) => update('additionalNotes', e.target.value)}
                placeholder="Any other information you'd like us to consider..."
                rows={2}
              />
            </div>
          </div>

          {/* Terms notice */}
          <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
            By submitting this application, you confirm that the information provided is accurate and
            agree to the NetNeural Reseller Program terms. Our team will review your application and
            contact you within 5 business days.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Submit Application
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
