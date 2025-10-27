'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface GoogleIotConfig {
  id?: string
  name: string
  project_id: string
  region: string
  registry_id: string
  service_account_key: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  integrationId?: string
  organizationId: string
  onSaved?: () => void
}

export function GoogleIotConfigDialog({ 
  open, 
  onOpenChange, 
  integrationId, 
  organizationId,
  onSaved 
}: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  
  const [config, setConfig] = useState<GoogleIotConfig>({
    name: 'Google Cloud IoT Integration',
    project_id: '',
    region: 'us-central1',
    registry_id: '',
    service_account_key: '',
  })

  useEffect(() => {
    if (integrationId && open) {
      loadConfig()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integrationId, open])

  const loadConfig = async () => {
    if (!integrationId) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('device_integrations')
        .select('*')
        .eq('id', integrationId)
        .single()

      if (error) throw error

      if (data && data.api_key_encrypted) {
        const cfg = JSON.parse(data.api_key_encrypted)
        setConfig({
          id: data.id,
          name: data.name,
          project_id: cfg?.project_id || '',
          region: cfg?.region || 'us-central1',
          registry_id: cfg?.registry_id || '',
          service_account_key: cfg?.service_account_key || '',
        })
      }
    } catch (error) {
      toast.error('Failed to load configuration')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!config.name || !config.project_id || !config.region || !config.registry_id || !config.service_account_key) {
      toast.error('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      const payload = {
        organization_id: organizationId,
        integration_type: 'google_iot',
        name: config.name,
        api_key_encrypted: JSON.stringify({
          project_id: config.project_id,
          region: config.region,
          registry_id: config.registry_id,
          service_account_key: config.service_account_key,
        }),
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

      toast.success('Google Cloud IoT configuration saved successfully')
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
            {integrationId ? 'Edit' : 'Add'} Google Cloud IoT Integration
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Integration Name *</Label>
            <Input
              id="name"
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
              placeholder="e.g., Google IoT Production"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-id">Project ID *</Label>
            <Input
              id="project-id"
              value={config.project_id}
              onChange={(e) => setConfig({ ...config, project_id: e.target.value })}
              placeholder="my-gcp-project"
            />
            <p className="text-sm text-muted-foreground">
              Your Google Cloud Platform project ID
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="region">Region *</Label>
              <Input
                id="region"
                value={config.region}
                onChange={(e) => setConfig({ ...config, region: e.target.value })}
                placeholder="us-central1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="registry-id">Registry ID *</Label>
              <Input
                id="registry-id"
                value={config.registry_id}
                onChange={(e) => setConfig({ ...config, registry_id: e.target.value })}
                placeholder="my-device-registry"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="service-account">Service Account Key (JSON) *</Label>
            <textarea
              id="service-account"
              value={config.service_account_key}
              onChange={(e) => setConfig({ ...config, service_account_key: e.target.value })}
              placeholder='{"type": "service_account", "project_id": "...", ...}'
              className="w-full min-h-[120px] p-3 border rounded-md font-mono text-sm"
            />
            <p className="text-sm text-muted-foreground">
              Paste the entire JSON key file content from your Google Cloud service account
            </p>
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
