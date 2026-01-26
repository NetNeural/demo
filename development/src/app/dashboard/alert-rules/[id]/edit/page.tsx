'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useOrganization } from '@/contexts/OrganizationContext'
import { edgeFunctions } from '@/lib/edge-functions/client'
import { RuleWizard } from '@/components/alerts/RuleWizard'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import type { AlertRule } from '@/lib/edge-functions/api/alert-rules'

// Route segment config for static export
export const dynamicParams = true
export const dynamic = 'error'

export default function EditAlertRulePage() {
  const router = useRouter()
  const params = useParams()
  const { currentOrganization } = useOrganization()
  const [rule, setRule] = useState<AlertRule | null>(null)
  const [loading, setLoading] = useState(true)

  const ruleId = params.id as string

  useEffect(() => {
    if (currentOrganization && ruleId) {
      fetchRule()
    }
  }, [currentOrganization, ruleId])

  const fetchRule = async () => {
    try {
      setLoading(true)
      const response = await edgeFunctions.alertRules.get(ruleId)

      if (response.success && response.data) {
        setRule(response.data)
      } else {
        toast.error('Failed to load rule')
        router.push('/dashboard/alert-rules')
      }
    } catch (error) {
      console.error('Error loading rule:', error)
      toast.error('Failed to load rule')
      router.push('/dashboard/alert-rules')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    )
  }

  if (!rule || !currentOrganization) {
    return <div>Rule not found</div>
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
        <h1 className="text-3xl font-bold">Edit Alert Rule</h1>
        <p className="text-muted-foreground mt-1">Modify your existing alert rule</p>
      </div>

      <RuleWizard
        organizationId={currentOrganization.id}
        initialData={rule}
        onSuccess={() => router.push('/dashboard/alert-rules')}
        onCancel={() => router.push('/dashboard/alert-rules')}
      />
    </div>
  )
}
