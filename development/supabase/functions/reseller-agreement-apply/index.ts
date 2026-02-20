// ===========================================================================
// Edge Function: reseller-agreement-apply
// ===========================================================================
// Handles reseller agreement applications:
//   1. Validates the application form data
//   2. Stores the application in reseller_agreement_applications table
//   3. Creates a GitHub Issue for review (label: reseller-application)
//   4. Returns the application status
//
// Also supports GET to fetch current application status for an org.
//
// POST /reseller-agreement-apply  { organizationId, ...form fields }
// GET  /reseller-agreement-apply?organizationId=xxx
// ===========================================================================

import {
  createEdgeFunction,
  createSuccessResponse,
  createErrorResponse,
  DatabaseError,
} from '../_shared/request-handler.ts'
import { createServiceClient } from '../_shared/auth.ts'

interface ApplicationRequest {
  organizationId: string
  // Applicant info
  applicantName: string
  applicantEmail: string
  applicantTitle?: string
  applicantPhone?: string
  // Company details
  companyLegalName: string
  companyAddress: string
  companyWebsite?: string
  companyTaxId?: string
  // Business case
  estimatedCustomers: number
  targetMarket?: string
  businessModel?: string
  preferredBilling?: string
  additionalNotes?: string
}

export default createEdgeFunction(
  async ({ req, userContext }) => {
    const user = userContext!
    const serviceClient = createServiceClient()

    // ── GET: Fetch current application/agreement status ──
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const organizationId = url.searchParams.get('organizationId')?.trim()
      if (!organizationId) {
        throw new DatabaseError(
          'organizationId query parameter is required',
          400
        )
      }

      // Check membership
      const { data: membership } = await serviceClient
        .from('organization_members')
        .select('role')
        .eq('user_id', user.userId)
        .eq('organization_id', organizationId)
        .single()

      if (!membership) {
        throw new DatabaseError(
          'You must be a member of this organization',
          403
        )
      }

      // Check for existing active agreement
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: agreement } = await (serviceClient as any)
        .from('reseller_agreements')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      // Check for existing application
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: application } = await (serviceClient as any)
        .from('reseller_agreement_applications')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      return createSuccessResponse({
        agreement: agreement || null,
        application: application || null,
      })
    }

    // ── POST: Submit new application ──
    if (req.method !== 'POST') {
      return createErrorResponse('Only GET and POST methods are supported', 405)
    }

    const body: ApplicationRequest = await req.json()
    const {
      organizationId,
      applicantName,
      applicantEmail,
      applicantTitle,
      applicantPhone,
      companyLegalName,
      companyAddress,
      companyWebsite,
      companyTaxId,
      estimatedCustomers,
      targetMarket,
      businessModel,
      preferredBilling,
      additionalNotes,
    } = body

    // Validate required fields
    if (!organizationId)
      throw new DatabaseError('organizationId is required', 400)
    if (!applicantName?.trim())
      throw new DatabaseError('applicantName is required', 400)
    if (!applicantEmail?.trim())
      throw new DatabaseError('applicantEmail is required', 400)
    if (!companyLegalName?.trim())
      throw new DatabaseError('companyLegalName is required', 400)
    if (!companyAddress?.trim())
      throw new DatabaseError('companyAddress is required', 400)
    if (!estimatedCustomers || estimatedCustomers < 1) {
      throw new DatabaseError('estimatedCustomers must be at least 1', 400)
    }

    // Verify user is an owner of the organization
    const { data: membership, error: memberError } = await serviceClient
      .from('organization_members')
      .select('role')
      .eq('user_id', user.userId)
      .eq('organization_id', organizationId)
      .single()

    if (memberError || !membership || membership.role !== 'owner') {
      throw new DatabaseError(
        'Only organization owners can apply for reseller agreements',
        403
      )
    }

    // Check for existing pending/active application
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingApp } = await (serviceClient as any)
      .from('reseller_agreement_applications')
      .select('id, status')
      .eq('organization_id', organizationId)
      .in('status', ['submitted', 'under_review'])
      .limit(1)
      .maybeSingle()

    if (existingApp) {
      throw new DatabaseError(
        'An application is already pending review. Please wait for it to be processed.',
        409
      )
    }

    // Check if org already has an active agreement
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingAgreement } = await (serviceClient as any)
      .from('reseller_agreements')
      .select('id, status')
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    if (existingAgreement) {
      throw new DatabaseError(
        'Your organization already has an active reseller agreement',
        409
      )
    }

    // Get organization details
    const { data: org } = await serviceClient
      .from('organizations')
      .select('name, slug')
      .eq('id', organizationId)
      .single()

    const orgLabel = org?.slug || org?.name || 'unknown-org'

    // ── Create GitHub Issue ──
    const issueTitle = `[Reseller Application] ${companyLegalName} (${org?.name || organizationId})`

    const billingLabels: Record<string, string> = {
      per_org: 'Per Organization',
      per_device: 'Per Device',
      flat_rate: 'Flat Rate',
    }

    const issueBody = `## Reseller Agreement Application

### Applicant Information
| Field | Value |
|-------|-------|
| **Name** | ${applicantName} |
| **Email** | ${applicantEmail} |
| **Title** | ${applicantTitle || 'N/A'} |
| **Phone** | ${applicantPhone || 'N/A'} |

### Company Details
| Field | Value |
|-------|-------|
| **Legal Name** | ${companyLegalName} |
| **Organization** | ${org?.name || organizationId} |
| **Address** | ${companyAddress} |
| **Website** | ${companyWebsite || 'N/A'} |
| **Tax ID** | ${companyTaxId || 'N/A'} |

### Business Case
| Field | Value |
|-------|-------|
| **Estimated Customers** | ${estimatedCustomers} |
| **Target Market** | ${targetMarket || 'N/A'} |
| **Preferred Billing** | ${billingLabels[preferredBilling || 'per_org'] || preferredBilling} |

**Business Model:**
${businessModel || 'Not provided'}

**Additional Notes:**
${additionalNotes || 'None'}

---

### Action Required
1. Review the application details above
2. If approved, create a reseller agreement in the database for org \`${organizationId}\`
3. Close this issue with a comment indicating approval/rejection

<details>
<summary>Internal Details</summary>

- **Organization ID:** ${organizationId}
- **Organization Slug:** ${orgLabel}
- **Applicant User ID:** ${user.userId}
- **Submitted:** ${new Date().toISOString()}
</details>

> _This issue was automatically created from the NetNeural Reseller Agreement Application form._`

    const labels = ['reseller-application', `org:${orgLabel}`]

    let githubIssueNumber: number | null = null
    let githubIssueUrl: string | null = null

    const githubToken = Deno.env.get('GITHUB_TOKEN')
    if (githubToken) {
      try {
        const ghResponse = await fetch(
          'https://api.github.com/repos/NetNeural/MonoRepo-Staging/issues',
          {
            method: 'POST',
            headers: {
              Authorization: `token ${githubToken}`,
              Accept: 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
              'User-Agent': 'NetNeural-Reseller-App-Bot',
            },
            body: JSON.stringify({
              title: issueTitle,
              body: issueBody,
              labels,
            }),
          }
        )

        if (ghResponse.ok) {
          const ghData = await ghResponse.json()
          githubIssueNumber = ghData.number
          githubIssueUrl = ghData.html_url
          console.log(
            `GitHub issue created for reseller application: #${githubIssueNumber}`
          )
        } else {
          const errorText = await ghResponse.text()
          console.error(`GitHub API error (${ghResponse.status}):`, errorText)
        }
      } catch (ghError) {
        console.error('GitHub API call failed:', ghError)
      }
    } else {
      console.warn(
        'GITHUB_TOKEN not configured — skipping GitHub issue creation'
      )
    }

    // ── Store application in database ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: application, error: insertError } = await (
      serviceClient as any
    )
      .from('reseller_agreement_applications')
      .insert({
        organization_id: organizationId,
        applicant_user_id: user.userId,
        applicant_name: applicantName.trim(),
        applicant_email: applicantEmail.trim(),
        applicant_title: applicantTitle?.trim() || null,
        applicant_phone: applicantPhone?.trim() || null,
        company_legal_name: companyLegalName.trim(),
        company_address: companyAddress.trim(),
        company_website: companyWebsite?.trim() || null,
        company_tax_id: companyTaxId?.trim() || null,
        estimated_customers: estimatedCustomers,
        target_market: targetMarket?.trim() || null,
        business_model: businessModel?.trim() || null,
        preferred_billing: preferredBilling || 'per_org',
        additional_notes: additionalNotes?.trim() || null,
        status: 'submitted',
        github_issue_number: githubIssueNumber,
        github_issue_url: githubIssueUrl,
      })
      .select('id, status, github_issue_number, github_issue_url, created_at')
      .single()

    if (insertError) {
      console.error('Application insert failed:', insertError)
      throw new DatabaseError(
        `Failed to save application: ${insertError.message}`,
        500
      )
    }

    return createSuccessResponse({
      application,
      message:
        'Your reseller agreement application has been submitted for review.',
    })
  },
  { requireAuth: true, allowedMethods: ['GET', 'POST'] }
)
