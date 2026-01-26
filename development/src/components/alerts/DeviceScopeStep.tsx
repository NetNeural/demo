'use client'

import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { edgeFunctions } from '@/lib/edge-functions/client'

interface DeviceScopeStepProps {
  organizationId: string
  state: any
  updateState: (updates: any) => void
}

interface Device {
  id: string
  name: string
  groups?: string[]
  tags?: string[]
}

export function DeviceScopeStep({ organizationId, state, updateState }: DeviceScopeStepProps) {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDevices()
  }, [organizationId])

  const fetchDevices = async () => {
    try {
      const response = await edgeFunctions.devices.list(organizationId)
      if (response.success && response.data) {
        // Handle both array and paginated response formats
        const deviceList = (Array.isArray(response.data) ? response.data : response.data.devices || []) as Device[]
        setDevices(deviceList)
      }
    } catch (error) {
      console.error('Error fetching devices:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateScope = (type: string, values?: string[]) => {
    updateState({
      deviceScope: {
        type,
        values,
      },
    })
  }

  const toggleDevice = (deviceId: string) => {
    const current = state.deviceScope.values || []
    const updated = current.includes(deviceId)
      ? current.filter((id: string) => id !== deviceId)
      : [...current, deviceId]
    updateScope('specific', updated)
  }

  // Extract unique groups and tags
  const allGroups = Array.from(
    new Set(devices.flatMap((d) => d.groups || []))
  )
  const allTags = Array.from(
    new Set(devices.flatMap((d) => d.tags || []))
  )

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Label>Select Devices to Monitor *</Label>
        <RadioGroup
          value={state.deviceScope.type}
          onValueChange={(value) => updateScope(value)}
        >
          <Card className={state.deviceScope.type === 'all' ? 'border-primary' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="all" id="all" className="mt-1" />
                <div>
                  <CardTitle>All Devices</CardTitle>
                  <CardDescription>
                    Monitor all devices in your organization ({devices.length} devices)
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          {allGroups.length > 0 && (
            <Card className={state.deviceScope.type === 'groups' ? 'border-primary' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="groups" id="groups" className="mt-1" />
                  <div className="flex-1">
                    <CardTitle>Specific Groups</CardTitle>
                    <CardDescription>Monitor devices in selected groups</CardDescription>
                  </div>
                </div>
              </CardHeader>
              {state.deviceScope.type === 'groups' && (
                <CardContent className="space-y-2">
                  {allGroups.map((group) => (
                    <div key={group} className="flex items-center space-x-2">
                      <Checkbox
                        id={`group-${group}`}
                        checked={(state.deviceScope.values || []).includes(group)}
                        onCheckedChange={(checked) => {
                          const current = state.deviceScope.values || []
                          const updated = checked
                            ? [...current, group]
                            : current.filter((g: string) => g !== group)
                          updateScope('groups', updated)
                        }}
                      />
                      <Label htmlFor={`group-${group}`}>{group}</Label>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )}

          {allTags.length > 0 && (
            <Card className={state.deviceScope.type === 'tags' ? 'border-primary' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="tags" id="tags" className="mt-1" />
                  <div className="flex-1">
                    <CardTitle>Specific Tags</CardTitle>
                    <CardDescription>Monitor devices with selected tags</CardDescription>
                  </div>
                </div>
              </CardHeader>
              {state.deviceScope.type === 'tags' && (
                <CardContent className="space-y-2">
                  {allTags.map((tag) => (
                    <div key={tag} className="flex items-center space-x-2">
                      <Checkbox
                        id={`tag-${tag}`}
                        checked={(state.deviceScope.values || []).includes(tag)}
                        onCheckedChange={(checked) => {
                          const current = state.deviceScope.values || []
                          const updated = checked
                            ? [...current, tag]
                            : current.filter((t: string) => t !== tag)
                          updateScope('tags', updated)
                        }}
                      />
                      <Label htmlFor={`tag-${tag}`}>{tag}</Label>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )}

          <Card className={state.deviceScope.type === 'specific' ? 'border-primary' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="specific" id="specific" className="mt-1" />
                <div className="flex-1">
                  <CardTitle>Specific Devices</CardTitle>
                  <CardDescription>Choose individual devices to monitor</CardDescription>
                </div>
              </div>
            </CardHeader>
            {state.deviceScope.type === 'specific' && (
              <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                {devices.map((device) => (
                  <div key={device.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`device-${device.id}`}
                      checked={(state.deviceScope.values || []).includes(device.id)}
                      onCheckedChange={() => toggleDevice(device.id)}
                    />
                    <Label htmlFor={`device-${device.id}`}>{device.name}</Label>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        </RadioGroup>
      </div>
    </div>
  )
}
