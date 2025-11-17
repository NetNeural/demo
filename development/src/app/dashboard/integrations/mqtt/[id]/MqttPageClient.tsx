'use client'

import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MqttConfigDialog } from '@/components/integrations/MqttConfigDialog'

export function MqttPageClient() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const integrationId = params.id as string
  const organizationId = searchParams.get('organizationId')

  const handleClose = () => {
    // Navigate back to integrations when closing
    router.push('/dashboard/organizations?tab=integrations')
  }

  if (!organizationId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-muted-foreground">Missing organization ID</p>
        <Button onClick={handleClose}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Integrations
        </Button>
      </div>
    )
  }

  // Render in page mode (inline, not as modal overlay)
  return (
    <MqttConfigDialog
      mode="page"
      open={true}
      onOpenChange={(open) => {
        if (!open) handleClose()
      }}
      integrationId={integrationId === 'new' ? undefined : integrationId}
      organizationId={organizationId}
      onSaved={handleClose}
    />
  )
}
