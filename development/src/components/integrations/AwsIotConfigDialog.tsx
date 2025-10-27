'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface AwsIotConfig {
  id?: string
  name: string
  region: string
  access_key_id: string
  secret_access_key: string
  endpoint?: string
  certificate?: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  integrationId?: string
  organizationId: string
  onSaved?: () => void
}

const AWS_REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-east-2', label: 'US East (Ohio)' },
  { value: 'us-west-1', label: 'US West (N. California)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'eu-west-1', label: 'EU (Ireland)' },
  { value: 'eu-central-1', label: 'EU (Frankfurt)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
]

export function AwsIotConfigDialog({ 
  open, 
  onOpenChange, 
  integrationId, 
  organizationId,
  onSaved 
}: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  
  const [config, setConfig] = useState<AwsIotConfig>({
    name: 'AWS IoT Integration',
    region: 'us-east-1',
    access_key_id: '',
    secret_access_key: '',
    endpoint: '',
    certificate: '',
  })

  const loadConfig = useCallback(async () => {
    if (!integrationId) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('device_integrations')
        .select('*')
        .eq('id', integrationId)
        .single()

      if (error) throw error

      if (data && data.settings) {
        const cfg = data.settings as Record<string, unknown>
        setConfig({
          id: data.id,
          name: data.name,
          region: (cfg?.region as string) || 'us-east-1',
          access_key_id: (cfg?.access_key_id as string) || '',
          secret_access_key: (cfg?.secret_access_key as string) || '',
          endpoint: (cfg?.endpoint as string) || '',
          certificate: (cfg?.certificate as string) || '',
        })
      }
    } catch (error) {
      toast.error('Failed to load configuration')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [integrationId])

  useEffect(() => {
    if (integrationId && open) {
      loadConfig()
    }
  }, [integrationId, open, loadConfig])

  const handleSave = async () => {
    if (!config.name || !config.region || !config.access_key_id || !config.secret_access_key) {
      toast.error('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      const payload = {
        organization_id: organizationId,
        integration_type: 'aws_iot',
        name: config.name,
        config: {
          region: config.region,
          access_key_id: config.access_key_id,
          secret_access_key: config.secret_access_key,
          endpoint: config.endpoint,
          certificate: config.certificate,
        },
        status: 'active',
      }

      if (integrationId) {
        const { error } = await supabase
          .from('device_integrations')
          .update(payload)
          .eq('id', integrationId)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('device_integrations')
          .insert(payload)

        if (error) throw error
      }

      toast.success('AWS IoT configuration saved successfully')
      onSaved?.()
      onOpenChange(false)
    } catch (error) {
      toast.error('Failed to save configuration')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white dark:bg-white">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-gray-900">
            {integrationId ? 'Edit' : 'Add'} AWS IoT Core Integration
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Integration Name *</Label>
            <Input
              id="name"
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
              placeholder="e.g., AWS IoT Production"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="region">AWS Region *</Label>
            <Select value={config.region} onValueChange={(value) => setConfig({ ...config, region: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AWS_REGIONS.map((region) => (
                  <SelectItem key={region.value} value={region.value}>
                    {region.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="access-key">Access Key ID *</Label>
            <Input
              id="access-key"
              type="password"
              value={config.access_key_id}
              onChange={(e) => setConfig({ ...config, access_key_id: e.target.value })}
              placeholder="AKIA..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="secret-key">Secret Access Key *</Label>
            <Input
              id="secret-key"
              type="password"
              value={config.secret_access_key}
              onChange={(e) => setConfig({ ...config, secret_access_key: e.target.value })}
              placeholder="Enter secret access key"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endpoint">Custom Endpoint (Optional)</Label>
            <Input
              id="endpoint"
              value={config.endpoint}
              onChange={(e) => setConfig({ ...config, endpoint: e.target.value })}
              placeholder="https://your-endpoint.iot.region.amazonaws.com"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
