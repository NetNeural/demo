'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertTriangle, Edit, Bell, Mail, MessageSquare, Plus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { Device } from '@/types/sensor-details'
import type { SensorThreshold } from '@/types/sensor-details'
import { edgeFunctions } from '@/lib/edge-functions/client'

interface AlertsThresholdsCardProps {
  device: Device
}

interface OrganizationMember {
  id: string
  full_name: string
  email: string
  role: string
}

export function AlertsThresholdsCard({ device }: AlertsThresholdsCardProps) {
  const { toast } = useToast()
  const [thresholds, setThresholds] = useState<SensorThreshold[]>([])
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [loading, setLoading] = useState(true)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedThreshold, setSelectedThreshold] = useState<SensorThreshold | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state for editing
  const [formData, setFormData] = useState({
    sensor_type: '',
    min_value: '',
    max_value: '',
    critical_min: '',
    critical_max: '',
    alert_enabled: true,
    alert_severity: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    alert_message: '',
    notify_on_breach: true,
    notification_cooldown_minutes: 15,
    notification_channels: [] as string[],
    notify_user_ids: [] as string[],
    notify_emails: [] as string[],
    manualEmails: '', // For the input field
  })

  useEffect(() => {
    fetchThresholds()
    fetchMembers()
  }, [device.id])

  const fetchThresholds = async () => {
    try {
      setLoading(true)
      const response = await edgeFunctions.thresholds.list(device.id) as any
      
      if (response.success) {
        setThresholds(response.data.thresholds || [])
      } else {
        console.error('Failed to fetch thresholds:', response.error)
      }
    } catch (error) {
      console.error('Error fetching thresholds:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMembers = async () => {
    try {
      // Get organization ID from device
      if (!device.organization_id) {
        console.warn('No organization_id on device:', device)
        return
      }
      
      console.log('Fetching members for organization:', device.organization_id)
      const response = await edgeFunctions.members.list(device.organization_id) as any
      
      console.log('Members API response:', response)
      
      if (response.success && response.data?.members) {
        console.log('Setting members:', response.data.members)
        setMembers(response.data.members)
      } else {
        console.warn('No members in response or request failed:', response)
      }
    } catch (error) {
      console.error('Error fetching members:', error)
    }
  }

  const handleEdit = (threshold: SensorThreshold) => {
    setSelectedThreshold(threshold)
    setFormData({
      sensor_type: threshold.sensor_type,
      min_value: threshold.min_value?.toString() || '',
      max_value: threshold.max_value?.toString() || '',
      critical_min: threshold.critical_min?.toString() || '',
      critical_max: threshold.critical_max?.toString() || '',
      alert_enabled: threshold.alert_enabled,
      alert_severity: threshold.alert_severity,
      alert_message: threshold.alert_message || '',
      notify_on_breach: threshold.notify_on_breach,
      notification_cooldown_minutes: threshold.notification_cooldown_minutes || 15,
      notification_channels: threshold.notification_channels || [],
      notify_user_ids: threshold.notify_user_ids || [],
      notify_emails: threshold.notify_emails || [],
      manualEmails: (threshold.notify_emails || []).join(', '),
    })
    setEditDialogOpen(true)
  }

  const handleAddNew = () => {
    setSelectedThreshold(null)
    setFormData({
      sensor_type: '',
      min_value: '',
      max_value: '',
      critical_min: '',
      critical_max: '',
      alert_enabled: true,
      alert_severity: 'medium',
      alert_message: '',
      notify_on_breach: true,
      notification_cooldown_minutes: 15,
      notification_channels: ['email'], // Default to email
      notify_user_ids: [],
      notify_emails: [],
      manualEmails: '',
    })
    setEditDialogOpen(true)
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      // Parse manual emails from comma-separated string
      const manualEmails = formData.manualEmails
        .split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0)

      const payload = {
        device_id: device.id,
        sensor_type: formData.sensor_type,
        min_value: formData.min_value ? parseFloat(formData.min_value) : null,
        max_value: formData.max_value ? parseFloat(formData.max_value) : null,
        critical_min: formData.critical_min ? parseFloat(formData.critical_min) : null,
        critical_max: formData.critical_max ? parseFloat(formData.critical_max) : null,
        alert_enabled: formData.alert_enabled,
        alert_severity: formData.alert_severity,
        alert_message: formData.alert_message || null,
        notify_on_breach: formData.notify_on_breach,
        notification_cooldown_minutes: formData.notification_cooldown_minutes,
        notification_channels: formData.notification_channels,
        notify_user_ids: formData.notify_user_ids,
        notify_emails: manualEmails,
      }

      const response = selectedThreshold
        ? await edgeFunctions.thresholds.update(selectedThreshold.id, payload)
        : await edgeFunctions.thresholds.create(payload)

      if (response.success) {
        toast({
          title: 'Success',
          description: `Threshold ${selectedThreshold ? 'updated' : 'created'} successfully`,
        })
        setEditDialogOpen(false)
        await fetchThresholds()
      } else {
        throw new Error(typeof response.error === 'string' ? response.error : 'Failed to save threshold')
      }
    } catch (error) {
      console.error('Error saving threshold:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save threshold',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const toggleNotificationChannel = (channel: string) => {
    setFormData(prev => ({
      ...prev,
      notification_channels: prev.notification_channels.includes(channel)
        ? prev.notification_channels.filter(c => c !== channel)
        : [...prev.notification_channels, channel]
    }))
  }

  const toggleUserNotification = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      notify_user_ids: prev.notify_user_ids.includes(userId)
        ? prev.notify_user_ids.filter(id => id !== userId)
        : [...prev.notify_user_ids, userId]
    }))
  }

  const activeAlerts = thresholds.filter(t => t.alert_enabled).length

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            ⚠️ Alerts & Thresholds
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading thresholds...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                ⚠️ Alerts & Thresholds
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure thresholds for each sensor type
              </p>
            </div>
            <Button onClick={handleAddNew} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Threshold
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">Active Alert Rules</span>
            <Badge variant={activeAlerts > 0 ? 'default' : 'secondary'}>
              {activeAlerts}/{thresholds.length}
            </Badge>
          </div>

          {thresholds.length === 0 ? (
            <div className="text-center py-8 border rounded-lg bg-muted/20">
              <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium mb-1">
                No thresholds configured yet
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Set up thresholds for temperature, humidity, battery, and other sensors
              </p>
              <Button onClick={handleAddNew} variant="outline" size="sm">
                Create First Threshold
              </Button>
            </div>
          ) : (
            <div className="space-y-3 pt-3 border-t">
              {thresholds.map((threshold) => (
                <div
                  key={threshold.id}
                  className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="font-medium text-sm capitalize">
                        {threshold.sensor_type.replace(/_/g, ' ')}
                      </p>
                      <Badge
                        variant={threshold.alert_enabled ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {threshold.alert_enabled ? 'Active' : 'Disabled'}
                      </Badge>
                      <Badge
                        variant={
                          threshold.alert_severity === 'critical' ? 'destructive' :
                          threshold.alert_severity === 'high' ? 'destructive' :
                          'secondary'
                        }
                        className="text-xs"
                      >
                        {threshold.alert_severity.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      {threshold.min_value && (
                        <div>Min: {threshold.min_value}</div>
                      )}
                      {threshold.max_value && (
                        <div>Max: {threshold.max_value}</div>
                      )}
                      {threshold.critical_min && (
                        <div className="text-red-600">Critical Min: {threshold.critical_min}</div>
                      )}
                      {threshold.critical_max && (
                        <div className="text-red-600">Critical Max: {threshold.critical_max}</div>
                      )}
                    </div>
                    {threshold.notify_on_breach && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Bell className="h-3 w-3" />
                        Notifications enabled (cooldown: {threshold.notification_cooldown_minutes}min)
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={() => handleEdit(threshold)}
                    variant="ghost"
                    size="sm"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedThreshold ? `Edit ${selectedThreshold.sensor_type} Threshold` : 'Create New Threshold'}
            </DialogTitle>
            <DialogDescription>
              {selectedThreshold 
                ? `Configure alert thresholds and notification preferences for ${selectedThreshold.sensor_type} sensor`
                : 'Each sensor type (temperature, humidity, battery, etc.) can have its own threshold configuration'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Sensor Type */}
            {!selectedThreshold && (
              <div className="space-y-2">
                <Label htmlFor="sensor_type">Sensor Type *</Label>
                <Select
                  value={formData.sensor_type}
                  onValueChange={(value) => {
                    if (value === 'custom') {
                      setFormData(prev => ({ ...prev, sensor_type: '' }))
                    } else {
                      setFormData(prev => ({ ...prev, sensor_type: value }))
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sensor type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="temperature">Temperature</SelectItem>
                    <SelectItem value="humidity">Humidity</SelectItem>
                    <SelectItem value="pressure">Pressure</SelectItem>
                    <SelectItem value="battery">Battery</SelectItem>
                    <SelectItem value="battery_voltage">Battery Voltage</SelectItem>
                    <SelectItem value="rssi">Signal Strength (RSSI)</SelectItem>
                    <SelectItem value="co2">CO2 Level</SelectItem>
                    <SelectItem value="light">Light Level</SelectItem>
                    <SelectItem value="motion">Motion</SelectItem>
                    <SelectItem value="vibration">Vibration</SelectItem>
                    <SelectItem value="custom">Custom...</SelectItem>
                  </SelectContent>
                </Select>
                {(formData.sensor_type === '' || !['temperature', 'humidity', 'pressure', 'battery', 'battery_voltage', 'rssi', 'co2', 'light', 'motion', 'vibration'].includes(formData.sensor_type)) && (
                  <Input
                    value={formData.sensor_type}
                    onChange={(e) => setFormData(prev => ({ ...prev, sensor_type: e.target.value }))}
                    placeholder="Enter custom sensor type"
                    className="mt-2"
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  Each sensor type can have its own threshold configuration
                </p>
              </div>
            )}

            {/* Threshold Values */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Warning Thresholds</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="min_value">Minimum Value</Label>
                  <Input
                    id="min_value"
                    type="number"
                    step="0.01"
                    value={formData.min_value}
                    onChange={(e) => setFormData(prev => ({ ...prev, min_value: e.target.value }))}
                    placeholder="Enter minimum"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_value">Maximum Value</Label>
                  <Input
                    id="max_value"
                    type="number"
                    step="0.01"
                    value={formData.max_value}
                    onChange={(e) => setFormData(prev => ({ ...prev, max_value: e.target.value }))}
                    placeholder="Enter maximum"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-sm text-red-600">Critical Thresholds</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="critical_min">Critical Minimum</Label>
                  <Input
                    id="critical_min"
                    type="number"
                    step="0.01"
                    value={formData.critical_min}
                    onChange={(e) => setFormData(prev => ({ ...prev, critical_min: e.target.value }))}
                    placeholder="Critical low value"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="critical_max">Critical Maximum</Label>
                  <Input
                    id="critical_max"
                    type="number"
                    step="0.01"
                    value={formData.critical_max}
                    onChange={(e) => setFormData(prev => ({ ...prev, critical_max: e.target.value }))}
                    placeholder="Critical high value"
                  />
                </div>
              </div>
            </div>

            {/* Alert Configuration */}
            <div className="space-y-4 pt-4 border-t">
              <h4 className="font-medium text-sm">Alert Configuration</h4>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="alert_enabled">Enable Alerts</Label>
                  <p className="text-xs text-muted-foreground">
                    Activate threshold monitoring and alerts
                  </p>
                </div>
                <Switch
                  id="alert_enabled"
                  checked={formData.alert_enabled}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, alert_enabled: checked }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="alert_severity">Alert Severity</Label>
                <Select
                  value={formData.alert_severity}
                  onValueChange={(value: any) => setFormData(prev => ({ ...prev, alert_severity: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="alert_message">Alert Message (Optional)</Label>
                <Input
                  id="alert_message"
                  value={formData.alert_message}
                  onChange={(e) => setFormData(prev => ({ ...prev, alert_message: e.target.value }))}
                  placeholder="Custom alert message"
                />
              </div>
            </div>

            {/* Notification Configuration */}
            <div className="space-y-4 pt-4 border-t">
              <h4 className="font-medium text-sm">Notification Settings</h4>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notify_on_breach">Send Notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    Notify when threshold is breached
                  </p>
                </div>
                <Switch
                  id="notify_on_breach"
                  checked={formData.notify_on_breach}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, notify_on_breach: checked }))}
                />
              </div>

              {formData.notify_on_breach && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="cooldown">Notification Cooldown (minutes)</Label>
                    <Input
                      id="cooldown"
                      type="number"
                      min="1"
                      value={formData.notification_cooldown_minutes}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        notification_cooldown_minutes: parseInt(e.target.value) || 15 
                      }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Minimum time between notifications for the same alert
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Label>Notification Channels</Label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">Email</p>
                            <p className="text-xs text-muted-foreground">Send email notifications</p>
                          </div>
                        </div>
                        <Switch
                          checked={formData.notification_channels.includes('email')}
                          onCheckedChange={() => toggleNotificationChannel('email')}
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">Slack</p>
                            <p className="text-xs text-muted-foreground">Post to Slack channel</p>
                          </div>
                        </div>
                        <Switch
                          checked={formData.notification_channels.includes('slack')}
                          onCheckedChange={() => toggleNotificationChannel('slack')}
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Bell className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">SMS</p>
                            <p className="text-xs text-muted-foreground">Send text messages</p>
                          </div>
                        </div>
                        <Switch
                          checked={formData.notification_channels.includes('sms')}
                          onCheckedChange={() => toggleNotificationChannel('sms')}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Email Recipients - Organization Members */}
                  {formData.notification_channels.includes('email') && (
                    <div className="space-y-3">
                      <Label>Notify Users</Label>
                      <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2">
                        {members.length === 0 ? (
                          <p className="text-sm text-muted-foreground p-2">No organization members found</p>
                        ) : (
                          members.map(member => (
                            <div key={member.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded">
                              <div className="flex-1">
                                <p className="text-sm font-medium">{member.full_name}</p>
                                <p className="text-xs text-muted-foreground">{member.email}</p>
                              </div>
                              <Switch
                                checked={formData.notify_user_ids.includes(member.id)}
                                onCheckedChange={() => toggleUserNotification(member.id)}
                              />
                            </div>
                          ))
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Select organization members to notify
                      </p>
                    </div>
                  )}

                  {/* Manual Email Addresses */}
                  {formData.notification_channels.includes('email') && (
                    <div className="space-y-2">
                      <Label htmlFor="manual_emails">Additional Email Addresses</Label>
                      <Input
                        id="manual_emails"
                        value={formData.manualEmails}
                        onChange={(e) => setFormData(prev => ({ ...prev, manualEmails: e.target.value }))}
                        placeholder="email1@example.com, email2@example.com"
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter email addresses separated by commas for external contacts
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => setEditDialogOpen(false)}
              variant="outline"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Threshold'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
