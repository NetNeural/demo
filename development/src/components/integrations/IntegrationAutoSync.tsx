'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronUp, Clock, Settings2, Loader2 } from 'lucide-react'
import { edgeFunctions } from '@/lib/edge-functions'
import { toast } from 'sonner'

interface AutoSyncConfig {
  enabled: boolean
  frequencyMinutes: number
  direction: 'import' | 'export' | 'bidirectional'
  conflictResolution: 'newest_wins' | 'local_wins' | 'remote_wins' | 'manual'
  onlyOnline: boolean
  timeWindowEnabled: boolean
  timeWindowStart?: string
  timeWindowEnd?: string
  deviceFilter: 'all' | 'tagged'
  deviceTags?: string[]
}

interface Props {
  integrationId: string
  organizationId: string
  integrationType: string
  availableDirections?: Array<'import' | 'export' | 'bidirectional'>
  onConfigChange?: (config: AutoSyncConfig) => void
}

const FREQUENCY_OPTIONS = [
  { value: 5, label: '5 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 180, label: '3 hours' },
  { value: 360, label: '6 hours' },
  { value: 720, label: '12 hours' },
  { value: 1440, label: '24 hours' },
]

export function IntegrationAutoSync({
  integrationId,
  organizationId,
  integrationType,
  availableDirections = ['import', 'export', 'bidirectional'],
  onConfigChange,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  const [config, setConfig] = useState<AutoSyncConfig>({
    enabled: false,
    frequencyMinutes: 15,
    direction: 'bidirectional',
    conflictResolution: 'newest_wins',
    onlyOnline: true,
    timeWindowEnabled: false,
    deviceFilter: 'all',
  })

  const [tagInput, setTagInput] = useState('')

  useEffect(() => {
    loadConfig()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integrationId])

  const loadConfig = async () => {
    setLoading(true)
    try {
      // TODO: Replace with actual API call
      const response = await edgeFunctions.call('auto-sync-config', {
        params: {
          integration_id: integrationId,
          organization_id: organizationId,
        },
      })

      if (response.success && response.data) {
        setConfig(response.data as AutoSyncConfig)
      }
    } catch (error) {
      console.error('Failed to load auto-sync config:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveConfig = async () => {
    setSaving(true)
    try {
      // TODO: Replace with actual API call
      const response = await edgeFunctions.call('auto-sync-config', {
        method: 'POST',
        body: {
          integration_id: integrationId,
          organization_id: organizationId,
          config,
        },
      })

      if (response.success) {
        toast.success('Auto-sync configuration saved')
        onConfigChange?.(config)
      } else {
        throw new Error(response.error?.message || 'Failed to save config')
      }
    } catch (error) {
      toast.error('Failed to save auto-sync configuration')
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  const updateConfig = (updates: Partial<AutoSyncConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }))
  }

  const addTag = () => {
    if (tagInput.trim() && !config.deviceTags?.includes(tagInput.trim())) {
      updateConfig({
        deviceTags: [...(config.deviceTags || []), tagInput.trim()],
      })
      setTagInput('')
    }
  }

  const removeTag = (tag: string) => {
    updateConfig({
      deviceTags: config.deviceTags?.filter((t) => t !== tag),
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Auto-Sync</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Automatically synchronize devices on a schedule
          </p>
        </div>
        
        <Button
          onClick={saveConfig}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Configuration
        </Button>
      </div>

      {/* Simple Mode */}
      <div className="rounded-lg border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto-sync-enabled" className="text-base font-medium">
              Enable Auto-Sync
            </Label>
            <p className="text-sm text-muted-foreground">
              {config.enabled ? 'Running' : 'Disabled'} - Syncs every{' '}
              {FREQUENCY_OPTIONS.find((opt) => opt.value === (config.frequencyMinutes || 15))?.label.toLowerCase() || '15 minutes'}
            </p>
          </div>
          <Switch
            id="auto-sync-enabled"
            checked={config.enabled}
            onCheckedChange={(enabled) => updateConfig({ enabled })}
          />
        </div>

        {config.enabled && (
          <div className="space-y-2">
            <Label htmlFor="frequency">Sync Frequency</Label>
            <Select
              value={(config.frequencyMinutes || 15).toString()}
              onValueChange={(value) => updateConfig({ frequencyMinutes: parseInt(value) })}
            >
              <SelectTrigger id="frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Next sync: {config.enabled ? 'In progress...' : 'Not scheduled'}
            </p>
          </div>
        )}
      </div>

      {/* Advanced Options */}
      {config.enabled && (
        <div className="space-y-4">
          <Button
            variant="outline"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full justify-between"
          >
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              <span>Advanced Options</span>
            </div>
            {showAdvanced ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          {showAdvanced && (
            <div className="rounded-lg border p-4 space-y-6 bg-muted/20">
              {/* Sync Direction */}
              <div className="space-y-3">
                <Label>Sync Direction</Label>
                <Select
                  value={config.direction}
                  onValueChange={(value) =>
                    updateConfig({ direction: value as AutoSyncConfig['direction'] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDirections.includes('import') && (
                      <SelectItem value="import">Import (Remote → Local)</SelectItem>
                    )}
                    {availableDirections.includes('export') && (
                      <SelectItem value="export">Export (Local → Remote)</SelectItem>
                    )}
                    {availableDirections.includes('bidirectional') && (
                      <SelectItem value="bidirectional">
                        Bidirectional (Keep in Sync)
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Conflict Resolution */}
              {config.direction === 'bidirectional' && (
                <div className="space-y-3">
                  <Label>Conflict Resolution</Label>
                  <RadioGroup
                    value={config.conflictResolution}
                    onValueChange={(value) =>
                      updateConfig({
                        conflictResolution: value as AutoSyncConfig['conflictResolution'],
                      })
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="newest_wins" id="newest" />
                      <Label htmlFor="newest" className="font-normal cursor-pointer">
                        Newest Wins (Recommended)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="local_wins" id="local" />
                      <Label htmlFor="local" className="font-normal cursor-pointer">
                        Local Wins (Prefer This System)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="remote_wins" id="remote" />
                      <Label htmlFor="remote" className="font-normal cursor-pointer">
                        Remote Wins (Prefer {integrationType})
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="manual" id="manual" />
                      <Label htmlFor="manual" className="font-normal cursor-pointer">
                        Manual Review (Pause and Notify)
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* Sync Conditions */}
              <div className="space-y-3">
                <Label>Sync Conditions</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="only-online"
                      checked={config.onlyOnline}
                      onCheckedChange={(checked) => updateConfig({ onlyOnline: checked })}
                    />
                    <Label htmlFor="only-online" className="font-normal cursor-pointer">
                      Only sync online devices
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="time-window"
                      checked={config.timeWindowEnabled}
                      onCheckedChange={(checked) =>
                        updateConfig({ timeWindowEnabled: checked })
                      }
                    />
                    <Label htmlFor="time-window" className="font-normal cursor-pointer">
                      Restrict to time window
                    </Label>
                  </div>
                </div>

                {config.timeWindowEnabled && (
                  <div className="grid grid-cols-2 gap-4 pl-6">
                    <div className="space-y-2">
                      <Label htmlFor="start-time">Start Time</Label>
                      <Input
                        id="start-time"
                        type="time"
                        value={config.timeWindowStart || '00:00'}
                        onChange={(e) =>
                          updateConfig({ timeWindowStart: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end-time">End Time</Label>
                      <Input
                        id="end-time"
                        type="time"
                        value={config.timeWindowEnd || '23:59'}
                        onChange={(e) => updateConfig({ timeWindowEnd: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Device Filters */}
              <div className="space-y-3">
                <Label>Device Filter</Label>
                <RadioGroup
                  value={config.deviceFilter}
                  onValueChange={(value) =>
                    updateConfig({ deviceFilter: value as 'all' | 'tagged' })
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="all-devices" />
                    <Label htmlFor="all-devices" className="font-normal cursor-pointer">
                      All devices
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="tagged" id="tagged-devices" />
                    <Label htmlFor="tagged-devices" className="font-normal cursor-pointer">
                      Only devices with specific tags
                    </Label>
                  </div>
                </RadioGroup>

                {config.deviceFilter === 'tagged' && (
                  <div className="space-y-2 pl-6">
                    <Label htmlFor="tags">Tags</Label>
                    <div className="flex gap-2">
                      <Input
                        id="tags"
                        placeholder="Enter tag name"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addTag()
                          }
                        }}
                      />
                      <Button onClick={addTag} variant="secondary">
                        Add
                      </Button>
                    </div>
                    {config.deviceTags && config.deviceTags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {config.deviceTags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => removeTag(tag)}
                          >
                            {tag} ×
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      {config.enabled && (
        <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-4">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            <strong>ℹ️ Auto-sync is active.</strong> Devices will sync automatically{' '}
            {config.direction === 'bidirectional' && 'in both directions'}{' '}
            every{' '}
            {FREQUENCY_OPTIONS.find((opt) => opt.value === config.frequencyMinutes)?.label.toLowerCase()}
            {config.deviceFilter === 'tagged' &&
              ` for ${config.deviceTags?.length || 0} tagged device(s)`}
            .
          </p>
        </div>
      )}
    </div>
  )
}
