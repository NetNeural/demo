'use client'

import { useRouter } from 'next/navigation'
import { useOrganization } from '@/contexts/OrganizationContext'
import { RuleWizard } from '@/components/alerts/RuleWizard'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function NewAlertRulePage() {
  const router = useRouter()
  const { currentOrganization } = useOrganization()

  if (!currentOrganization) {
    return <div>Please select an organization</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/dashboard/alert-rules')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Rules
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold">Create Alert Rule</h1>
        <p className="text-muted-foreground mt-1">
          Set up automated monitoring and alerts for your devices
        </p>
      </div>

      <RuleWizard
        organizationId={currentOrganization.id}
        onSuccess={() => router.push('/dashboard/alert-rules')}
        onCancel={() => router.push('/dashboard/alert-rules')}
      />
    </div>
  )
}
