'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GoliothConfigDialog } from '@/components/integrations/GoliothConfigDialog'
import { MqttConfigDialog } from '@/components/integrations/MqttConfigDialog'
import { AwsIotConfigDialog } from '@/components/integrations/AwsIotConfigDialog'
import { AzureIotConfigDialog } from '@/components/integrations/AzureIotConfigDialog'
import { EmailConfigDialog } from '@/components/integrations/EmailConfigDialog'
import { SlackConfigDialog } from '@/components/integrations/SlackConfigDialog'
import { WebhookConfigDialog } from '@/components/integrations/WebhookConfigDialog'
import { NetNeuralHubConfigDialog } from '@/components/integrations/NetNeuralHubConfigDialog'

export default function IntegrationViewPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const integrationId = searchParams.get('id')
  const organizationId = searchParams.get('organizationId')
  const integrationType = searchParams.get('type')

  const handleClose = () => {
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

  if (!integrationType) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-muted-foreground">Missing integration type</p>
        <Button onClick={handleClose}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Integrations
        </Button>
      </div>
    )
  }

  // Render the appropriate config dialog based on integration type
  // All dialogs render as INLINE pages (not modal overlays)
  const commonProps = {
    open: true,
    onOpenChange: (open: boolean) => {
      if (!open) handleClose()
    },
    integrationId: integrationId === 'new' ? undefined : integrationId || undefined,
    organizationId,
    onSaved: handleClose,
    mode: 'page' as const,
  }

  switch (integrationType) {
    case 'golioth':
      return <GoliothConfigDialog {...commonProps} />
    
    case 'mqtt':
    case 'mqtt_hosted':
    case 'mqtt_external':
      return <MqttConfigDialog {...commonProps} initialBrokerType={integrationType === 'mqtt_external' ? 'external' : 'hosted'} />
    
    case 'aws_iot':
      return <AwsIotConfigDialog {...commonProps} />
    
    case 'azure_iot':
      return <AzureIotConfigDialog {...commonProps} />
    
    case 'email':
      return <EmailConfigDialog {...commonProps} />
    
    case 'slack':
      return <SlackConfigDialog {...commonProps} />
    
    case 'webhook':
      return <WebhookConfigDialog {...commonProps} />
    
    case 'netneural_hub':
      return <NetNeuralHubConfigDialog {...commonProps} />
    
    default:
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <p className="text-muted-foreground">Integration type &quot;{integrationType}&quot; is not yet supported</p>
          <Button onClick={handleClose}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Integrations
          </Button>
        </div>
      )
  }
}
