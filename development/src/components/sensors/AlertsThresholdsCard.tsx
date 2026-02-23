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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertTriangle,
  Edit,
  Bell,
  Mail,
  MessageSquare,
  Plus,
  Trash2,
  TestTube,
  Sparkles,
  Loader2,
  Info,
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { toast as sonnerToast } from 'sonner'
import type { Device } from '@/types/sensor-details'
import type { SensorThreshold } from '@/types/sensor-details'
import { edgeFunctions } from '@/lib/edge-functions/client'
import type { AIRecommendation } from '@/lib/edge-functions/api/thresholds'

interface AlertsThresholdsCardProps {
  device: Device
  temperatureUnit: 'celsius' | 'fahrenheit'
  onTemperatureUnitChange: (unit: 'celsius' | 'fahrenheit') => void
}

interface OrganizationMember {
  id: string
  full_name: string
  email: string
  role: string
}

export function AlertsThresholdsCard({
  device,
  temperatureUnit,
  onTemperatureUnitChange,
}: AlertsThresholdsCardProps) {
  const { toast } = useToast()
  const [thresholds, setThresholds] = useState<SensorThreshold[]>([])
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [loading, setLoading] = useState(true)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedThreshold, setSelectedThreshold] =
    useState<SensorThreshold | null>(null)
  const [thresholdToDelete, setThresholdToDelete] =
    useState<SensorThreshold | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)

  // AI recommendation state
  const [aiEnabled, setAiEnabled] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiRecommendation, setAiRecommendation] =
    useState<AIRecommendation | null>(null)

  // Form state for editing
  const [formData, setFormData] = useState({
    sensor_type: '',
    min_value: '',
    max_value: '',
    critical_min: '',
    critical_max: '',
    temperature_unit: 'celsius' as 'celsius' | 'fahrenheit',
    alert_enabled: true,
    alert_severity: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    alert_message: '',
    notify_on_breach: true,
    notification_cooldown_minutes: 15,
    notification_channels: [] as string[],
    notify_user_ids: [] as string[],
    notify_emails: [] as string[],
    notify_phone_numbers: [] as string[],
    manualEmails: '', // For the input field
    manualPhones: '', // For the SMS phone input field
  })

  useEffect(() => {
    fetchThresholds()
    fetchMembers()
  }, [device.id])

  const fetchThresholds = async () => {
    try {
      setLoading(true)
      const response = (await edgeFunctions.thresholds.list(device.id)) as any

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
      const response = (await edgeFunctions.members.list(
        device.organization_id
      )) as any

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
      temperature_unit: (threshold as any).temperature_unit || temperatureUnit,
      notify_on_breach: threshold.notify_on_breach,
      notification_cooldown_minutes:
        threshold.notification_cooldown_minutes || 15,
      notification_channels: threshold.notification_channels || [],
      notify_user_ids: threshold.notify_user_ids || [],
      notify_emails: threshold.notify_emails || [],
      notify_phone_numbers: threshold.notify_phone_numbers || [],
      manualEmails: (threshold.notify_emails || []).join(', '),
      manualPhones: (threshold.notify_phone_numbers || []).join(', '),
    })
    setAiEnabled(false)
    setAiRecommendation(null)
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
      temperature_unit: temperatureUnit,
      alert_enabled: true,
      alert_severity: 'medium',
      alert_message: '',
      notify_on_breach: true,
      notification_cooldown_minutes: 15,
      notification_channels: ['email'], // Default to email
      notify_user_ids: [],
      notify_emails: [],
      notify_phone_numbers: [],
      manualEmails: '',
      manualPhones: '',
    })
    setAiEnabled(false)
    setAiRecommendation(null)
    setEditDialogOpen(true)
  }

  const handleAIToggle = async (checked: boolean) => {
    setAiEnabled(checked)
    if (!checked) {
      setAiRecommendation(null)
      return
    }

    // Need a sensor type to make recommendations
    const sensorType = formData.sensor_type || selectedThreshold?.sensor_type
    if (!sensorType) {
      sonnerToast.error('Select a sensor type first', {
        description:
          'AI recommendations require a sensor type to analyze the correct telemetry data.',
      })
      setAiEnabled(false)
      return
    }

    setAiLoading(true)
    try {
      const response = (await edgeFunctions.thresholds.recommend(
        device.id,
        sensorType,
        formData.temperature_unit
      )) as any

      if (!response.success) {
        throw new Error(response.error || 'Failed to get AI recommendations')
      }

      const rec: AIRecommendation = response.data
      setAiRecommendation(rec)

      if (rec.available && rec.recommended) {
        // Auto-fill form with recommended values
        setFormData((prev) => ({
          ...prev,
          min_value: rec.recommended!.min_value.toString(),
          max_value: rec.recommended!.max_value.toString(),
          critical_min: rec.recommended!.critical_min.toString(),
          critical_max: rec.recommended!.critical_max.toString(),
        }))
        sonnerToast.success('AI thresholds applied', {
          description: `Based on ${rec.data_points} data points. You can still adjust the values before saving.`,
        })
      } else {
        sonnerToast.info('Not enough data yet', {
          description: rec.message,
        })
      }
    } catch (error) {
      console.error('AI recommendation error:', error)
      sonnerToast.error('AI recommendation failed', {
        description:
          error instanceof Error
            ? error.message
            : 'Could not analyze telemetry data',
      })
      setAiEnabled(false)
    } finally {
      setAiLoading(false)
    }
  }

  const handleSave = async () => {
    console.log('🔵 [THRESHOLD SAVE] handleSave called')
    console.log('🔵 [THRESHOLD SAVE] Form data:', formData)
    console.log('🔵 [THRESHOLD SAVE] Selected threshold:', selectedThreshold)

    try {
      setSaving(true)
      console.log('🔵 [THRESHOLD SAVE] Saving state set to true')

      // Validate threshold hierarchy: critical_min ≤ min_value ≤ max_value ≤ critical_max
      const minVal = formData.min_value ? parseFloat(formData.min_value) : null
      const maxVal = formData.max_value ? parseFloat(formData.max_value) : null
      const critMin = formData.critical_min
        ? parseFloat(formData.critical_min)
        : null
      const critMax = formData.critical_max
        ? parseFloat(formData.critical_max)
        : null

      if (minVal != null && maxVal != null && minVal >= maxVal) {
        sonnerToast.error('Invalid thresholds', {
          description: 'Warning Minimum must be less than Warning Maximum.',
        })
        setSaving(false)
        return
      }

      if (critMin != null && minVal != null && critMin > minVal) {
        sonnerToast.error('Invalid thresholds', {
          description:
            'Critical Minimum must be less than or equal to Warning Minimum. Critical min represents the extreme low boundary below which the situation is critical.',
        })
        setSaving(false)
        return
      }

      if (critMax != null && maxVal != null && critMax < maxVal) {
        sonnerToast.error('Invalid thresholds', {
          description:
            'Critical Maximum must be greater than or equal to Warning Maximum. Critical max represents the extreme high boundary above which the situation is critical.',
        })
        setSaving(false)
        return
      }

      if (critMin != null && critMax != null && critMin >= critMax) {
        sonnerToast.error('Invalid thresholds', {
          description: 'Critical Minimum must be less than Critical Maximum.',
        })
        setSaving(false)
        return
      }

      // Parse manual emails from comma-separated string
      const manualEmails = formData.manualEmails
        .split(',')
        .map((email) => email.trim())
        .filter((email) => email.length > 0)

      // Parse manual phone numbers from comma-separated string
      const manualPhones = formData.manualPhones
        .split(',')
        .map((phone) => phone.trim())
        .filter((phone) => phone.length > 0)

      const payload = {
        device_id: device.id,
        sensor_type: formData.sensor_type,
        min_value: formData.min_value ? parseFloat(formData.min_value) : null,
        max_value: formData.max_value ? parseFloat(formData.max_value) : null,
        critical_min: formData.critical_min
          ? parseFloat(formData.critical_min)
          : null,
        critical_max: formData.critical_max
          ? parseFloat(formData.critical_max)
          : null,
        temperature_unit: formData.temperature_unit,
        alert_enabled: formData.alert_enabled,
        alert_severity: formData.alert_severity,
        alert_message: formData.alert_message || null,
        notify_on_breach: formData.notify_on_breach,
        notification_cooldown_minutes: formData.notification_cooldown_minutes,
        notification_channels: formData.notification_channels,
        notify_user_ids: formData.notify_user_ids,
        notify_emails: manualEmails,
        notify_phone_numbers: manualPhones,
      }

      console.log('🔵 [THRESHOLD SAVE] Payload prepared:', payload)
      console.log('🔵 [THRESHOLD SAVE] Calling Edge Function...')

      const response = selectedThreshold
        ? await edgeFunctions.thresholds.update(selectedThreshold.id, payload)
        : await edgeFunctions.thresholds.create(payload)

      console.log('🔵 [THRESHOLD SAVE] Edge Function response:', response)

      if (response.success) {
        console.log('✅ [THRESHOLD SAVE] Save successful')
        toast({
          title: 'Success',
          description: `Threshold ${selectedThreshold ? 'updated' : 'created'} successfully`,
        })
        setEditDialogOpen(false)
        await fetchThresholds()
        console.log('✅ [THRESHOLD SAVE] Thresholds refreshed')
      } else {
        console.error('❌ [THRESHOLD SAVE] Save failed:', response.error)
        throw new Error(
          typeof response.error === 'string'
            ? response.error
            : 'Failed to save threshold'
        )
      }
    } catch (error) {
      console.error('❌ [THRESHOLD SAVE] Exception caught:', error)
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to save threshold',
        variant: 'destructive',
      })
    } finally {
      console.log('🔵 [THRESHOLD SAVE] Finally block - setting saving to false')
      setSaving(false)
    }
  }

  const handleDeleteClick = (threshold: SensorThreshold) => {
    setThresholdToDelete(threshold)
    setDeleteDialogOpen(true)
  }

  const handleTestAlert = async (threshold: SensorThreshold) => {
    console.log('[TEST ALERT] Button clicked for threshold:', threshold.id)

    try {
      setTesting(threshold.id)
      console.log('[TEST ALERT] Creating test alert...')

      // Get sensor type name mapping
      const sensorNames: Record<string, string> = {
        '1': 'Temperature',
        temperature: 'Temperature',
        '2': 'Humidity',
        humidity: 'Humidity',
        '3': 'Pressure',
        pressure: 'Pressure',
        '4': 'Battery',
        battery: 'Battery',
      }

      const sensorName =
        sensorNames[threshold.sensor_type] || threshold.sensor_type

      // Map to valid category
      const categoryMap: Record<string, string> = {
        temperature: 'temperature',
        humidity: 'temperature',
        pressure: 'temperature',
        battery: 'battery',
      }
      const category = categoryMap[sensorName.toLowerCase()] || 'system'

      const alertData = {
        organization_id: device.organization_id || '',
        device_id: device.id,
        alert_type: `${sensorName.toLowerCase()}_threshold`,
        category: category,
        title: `🧪 TEST ALERT: ${sensorName} Threshold`,
        message: `⚠️ THIS IS A TEST ALERT - NOT A REAL ISSUE ⚠️\n\nDevice: ${device.name}\nSensor: ${sensorName}\nThreshold ID: ${threshold.id}\n\nThis test verifies that the alert system is working correctly. You can safely acknowledge or delete this test alert.`,
        severity: threshold.alert_severity,
        metadata: {
          is_test: true,
          sensor_type: threshold.sensor_type,
          sensor_name: sensorName,
          threshold_id: threshold.id,
          min_value: threshold.min_value,
          max_value: threshold.max_value,
          critical_min: threshold.critical_min,
          critical_max: threshold.critical_max,
        },
      }

      console.log(
        '[TEST ALERT] Inserting alert data via edge function:',
        alertData
      )

      // Create test alert via edge function (bypasses RLS)
      const response = (await edgeFunctions.alerts.create(alertData)) as {
        success: boolean
        data?: { alert?: { id: string } }
        error?: string
      }

      if (!response.success) {
        console.error('[TEST ALERT] Insert error:', response.error)
        throw new Error(
          typeof response.error === 'string'
            ? response.error
            : 'Failed to create test alert'
        )
      }

      const alertId = response.data?.alert?.id
      console.log('[TEST ALERT] Alert created successfully:', alertId)

      // Show immediate success for alert creation
      sonnerToast.success('✅ Test Alert Created!', {
        description: `Test alert has been created successfully. Sending notifications...`,
        duration: 3000,
      })

      // Send notifications via all configured channels (email, slack, sms)
      if (alertId) {
        console.log('[TEST ALERT] Sending notifications for alert:', alertId)
        console.log(
          '[TEST ALERT] Threshold channels:',
          threshold.notification_channels
        )
        console.log(
          '[TEST ALERT] Threshold notify_emails:',
          threshold.notify_emails
        )
        console.log(
          '[TEST ALERT] Threshold notify_user_ids:',
          threshold.notify_user_ids
        )
        console.log(
          '[TEST ALERT] Threshold notify_phone_numbers:',
          threshold.notify_phone_numbers
        )

        try {
          const notifResponse = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-alert-notifications`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({
                alert_id: alertId,
                threshold_id: threshold.id,
              }),
            }
          )

          const notifResult = await notifResponse.json()
          console.log('[TEST ALERT] Notification response:', notifResult)

          if (notifResult.success && notifResult.channels_succeeded > 0) {
            const channelsSummary = (notifResult.results || [])
              .filter((r: { success: boolean }) => r.success)
              .map(
                (r: { channel: string; detail?: string }) =>
                  `${r.channel}: ${r.detail || 'OK'}`
              )
              .join(', ')
            sonnerToast.success('📨 Notifications Sent!', {
              description: `${notifResult.channels_succeeded}/${notifResult.channels_dispatched} channels succeeded. ${channelsSummary}`,
              duration: 7000,
            })
          } else if (
            notifResult.success &&
            notifResult.channels_dispatched === 0
          ) {
            sonnerToast.info('ℹ️ No Notification Channels', {
              description:
                'No notification channels configured for this threshold. Add email, Slack, or SMS in the threshold settings.',
              duration: 5000,
            })
          } else {
            const failedChannels = (notifResult.results || [])
              .filter((r: { success: boolean }) => !r.success)
              .map(
                (r: { channel: string; error?: string }) =>
                  `${r.channel}: ${r.error || 'failed'}`
              )
              .join(', ')
            sonnerToast.warning('⚠️ Some Notifications Failed', {
              description: `Test alert created but some channels failed: ${failedChannels}`,
              duration: 5000,
            })
          }
        } catch (notifError) {
          console.error('[TEST ALERT] Notification sending error:', notifError)
          sonnerToast.error('❌ Notification Error', {
            description: `Test alert created but notification service encountered an error: ${notifError instanceof Error ? notifError.message : 'Network error'}`,
            duration: 5000,
          })
        }
      }
    } catch (error) {
      console.error('[TEST ALERT] Error creating test alert:', error)
      sonnerToast.error('Failed to Create Test Alert', {
        description:
          error instanceof Error ? error.message : 'An unknown error occurred',
      })
    } finally {
      setTesting(null)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!thresholdToDelete) return

    try {
      setDeleting(true)

      const response = await edgeFunctions.thresholds.delete(
        thresholdToDelete.id
      )

      if (response.success) {
        toast({
          title: 'Success',
          description: `Threshold for ${thresholdToDelete.sensor_type} deleted successfully`,
        })
        setDeleteDialogOpen(false)
        setThresholdToDelete(null)
        await fetchThresholds()
      } else {
        throw new Error(
          typeof response.error === 'string'
            ? response.error
            : 'Failed to delete threshold'
        )
      }
    } catch (error) {
      console.error('Error deleting threshold:', error)
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to delete threshold',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  const toggleNotificationChannel = (channel: string) => {
    setFormData((prev) => ({
      ...prev,
      notification_channels: prev.notification_channels.includes(channel)
        ? prev.notification_channels.filter((c) => c !== channel)
        : [...prev.notification_channels, channel],
    }))
  }

  const toggleUserNotification = (userId: string) => {
    setFormData((prev) => ({
      ...prev,
      notify_user_ids: prev.notify_user_ids.includes(userId)
        ? prev.notify_user_ids.filter((id) => id !== userId)
        : [...prev.notify_user_ids, userId],
    }))
  }

  const activeAlerts = thresholds.filter((t) => t.alert_enabled).length

  // Helper to get unit symbol for sensor values
  const getUnitSymbol = (threshold: SensorThreshold) => {
    const sensorType = threshold.sensor_type.toLowerCase()
    if (sensorType === 'temperature') {
      const unit = (threshold as any).temperature_unit || 'celsius'
      return unit === 'fahrenheit' ? '°F' : '°C'
    }
    if (sensorType === 'humidity') {
      return '%'
    }
    return ''
  }

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
              <Plus className="mr-2 h-4 w-4" />
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
            <div className="rounded-lg border bg-muted/20 py-8 text-center">
              <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="mb-1 text-sm font-medium">
                No thresholds configured yet
              </p>
              <p className="mb-4 text-xs text-muted-foreground">
                Set up thresholds for temperature, humidity, battery, and other
                sensors
              </p>
              <Button onClick={handleAddNew} variant="outline" size="sm">
                Create First Threshold
              </Button>
            </div>
          ) : (
            <div className="space-y-3 border-t pt-3">
              {thresholds.map((threshold) => (
                <div
                  key={threshold.id}
                  className="flex items-start justify-between rounded-lg border p-3 transition-colors hover:bg-muted/30"
                >
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-3">
                      <p className="text-sm font-medium capitalize">
                        {threshold.sensor_type.replace(/_/g, ' ')}
                      </p>
                      <Badge
                        variant={
                          threshold.alert_enabled ? 'default' : 'secondary'
                        }
                        className="text-xs"
                      >
                        {threshold.alert_enabled ? 'Active' : 'Disabled'}
                      </Badge>
                      <Badge
                        variant={
                          threshold.alert_severity === 'critical'
                            ? 'destructive'
                            : threshold.alert_severity === 'high'
                              ? 'destructive'
                              : 'secondary'
                        }
                        className="text-xs"
                      >
                        {threshold.alert_severity.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      {threshold.min_value && (
                        <div>
                          Min: {threshold.min_value}
                          {getUnitSymbol(threshold)}
                        </div>
                      )}
                      {threshold.max_value && (
                        <div>
                          Max: {threshold.max_value}
                          {getUnitSymbol(threshold)}
                        </div>
                      )}
                      {threshold.critical_min && (
                        <div className="text-red-600">
                          Critical Min: {threshold.critical_min}
                          {getUnitSymbol(threshold)}
                        </div>
                      )}
                      {threshold.critical_max && (
                        <div className="text-red-600">
                          Critical Max: {threshold.critical_max}
                          {getUnitSymbol(threshold)}
                        </div>
                      )}
                    </div>
                    {threshold.notify_on_breach && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                        <Bell className="h-3 w-3" />
                        Notifications enabled (cooldown:{' '}
                        {threshold.notification_cooldown_minutes}min)
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      onClick={() => handleTestAlert(threshold)}
                      variant="ghost"
                      size="sm"
                      disabled={testing === threshold.id}
                      title="Create a test alert to verify the alert system is working"
                      aria-label="Test alert"
                    >
                      <TestTube className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => handleEdit(threshold)}
                      variant="ghost"
                      size="sm"
                      aria-label="Edit threshold"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => handleDeleteClick(threshold)}
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      aria-label="Delete threshold"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col">
          <DialogHeader>
            <DialogTitle>
              {selectedThreshold
                ? `Edit ${selectedThreshold.sensor_type} Threshold`
                : 'Create New Threshold'}
            </DialogTitle>
            <DialogDescription>
              {selectedThreshold
                ? `Configure alert thresholds and notification preferences for ${selectedThreshold.sensor_type} sensor`
                : 'Each sensor type (temperature, humidity, battery, etc.) can have its own threshold configuration'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-6 overflow-y-auto py-4 pr-2">
            {/* Sensor Type */}
            {/* Sensor Type */}
            {!selectedThreshold && (
              <div className="space-y-2">
                <Label htmlFor="sensor_type">Sensor Type *</Label>
                <Select
                  value={formData.sensor_type}
                  onValueChange={(value) => {
                    if (value === 'custom') {
                      setFormData((prev) => ({ ...prev, sensor_type: '' }))
                    } else {
                      setFormData((prev) => ({ ...prev, sensor_type: value }))
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
                    <SelectItem value="battery_voltage">
                      Battery Voltage
                    </SelectItem>
                    <SelectItem value="rssi">Signal Strength (RSSI)</SelectItem>
                    <SelectItem value="co2">CO2 Level</SelectItem>
                    <SelectItem value="light">Light Level</SelectItem>
                    <SelectItem value="motion">Motion</SelectItem>
                    <SelectItem value="vibration">Vibration</SelectItem>
                    <SelectItem value="custom">Custom...</SelectItem>
                  </SelectContent>
                </Select>
                {(formData.sensor_type === '' ||
                  ![
                    'temperature',
                    'humidity',
                    'pressure',
                    'battery',
                    'battery_voltage',
                    'rssi',
                    'co2',
                    'light',
                    'motion',
                    'vibration',
                  ].includes(formData.sensor_type)) && (
                  <Input
                    value={formData.sensor_type}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        sensor_type: e.target.value,
                      }))
                    }
                    placeholder="Enter custom sensor type"
                    className="mt-2"
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  Each sensor type can have its own threshold configuration
                </p>
              </div>
            )}

            {/* Temperature Unit Selector - Only for temperature sensors */}
            {formData.sensor_type === 'temperature' && (
              <div className="space-y-2">
                <Label htmlFor="temperature_unit">Temperature Unit</Label>
                <Select
                  value={formData.temperature_unit}
                  onValueChange={(value: 'celsius' | 'fahrenheit') => {
                    setFormData((prev) => ({
                      ...prev,
                      temperature_unit: value,
                    }))
                    // Immediately notify parent for instant UI update
                    onTemperatureUnitChange(value)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="celsius">Celsius (°C)</SelectItem>
                    <SelectItem value="fahrenheit">Fahrenheit (°F)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Unit for threshold values
                </p>
              </div>
            )}

            {/* AI Auto-Threshold */}
            <div className="space-y-3 rounded-lg border bg-gradient-to-r from-violet-50/50 to-blue-50/50 p-4 dark:from-violet-950/20 dark:to-blue-950/20">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="ai_thresholds"
                  checked={aiEnabled}
                  onCheckedChange={(checked) =>
                    handleAIToggle(checked === true)
                  }
                  disabled={aiLoading}
                />
                <div className="flex-1">
                  <label
                    htmlFor="ai_thresholds"
                    className="flex cursor-pointer items-center gap-2 text-sm font-medium"
                  >
                    <Sparkles className="h-4 w-4 text-violet-500" />
                    Set thresholds from telemetry data
                    {aiLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                  </label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Analyzes historical sensor readings to calculate optimal
                    warning and critical ranges using statistical modeling (mean
                    ± standard deviations).
                  </p>
                </div>
              </div>

              {/* AI Recommendation Result */}
              {aiRecommendation && (
                <div className="mt-3 space-y-2 text-xs">
                  {aiRecommendation.available && aiRecommendation.statistics ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 font-medium text-violet-600 dark:text-violet-400">
                        <Sparkles className="h-3 w-3" />
                        Analysis of {aiRecommendation.data_points} readings
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                        <div>
                          Mean:{' '}
                          <span className="font-mono">
                            {aiRecommendation.statistics.mean}
                          </span>
                        </div>
                        <div>
                          Std Dev:{' '}
                          <span className="font-mono">
                            {aiRecommendation.statistics.stddev}
                          </span>
                        </div>
                        <div>
                          Observed Min:{' '}
                          <span className="font-mono">
                            {aiRecommendation.statistics.min_observed}
                          </span>
                        </div>
                        <div>
                          Observed Max:{' '}
                          <span className="font-mono">
                            {aiRecommendation.statistics.max_observed}
                          </span>
                        </div>
                      </div>
                      <p className="text-muted-foreground">
                        Thresholds have been filled in below. You can still
                        adjust the values before saving.
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 rounded bg-amber-50 p-2 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <p>{aiRecommendation.message}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Threshold Values */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Warning Thresholds</h4>
              <p className="text-xs text-muted-foreground">
                Defines the normal operating range. A warning alert fires when
                the value drops below the minimum or rises above the maximum.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="min_value">
                    Minimum Value
                    {formData.sensor_type === 'temperature' &&
                      ` (°${formData.temperature_unit === 'fahrenheit' ? 'F' : 'C'})`}
                    {formData.sensor_type === 'humidity' && ' (%)'}
                  </Label>
                  <Input
                    id="min_value"
                    type="number"
                    step="0.01"
                    value={formData.min_value}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        min_value: e.target.value,
                      }))
                    }
                    placeholder="Enter minimum"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_value">
                    Maximum Value
                    {formData.sensor_type === 'temperature' &&
                      ` (°${formData.temperature_unit === 'fahrenheit' ? 'F' : 'C'})`}
                    {formData.sensor_type === 'humidity' && ' (%)'}
                  </Label>
                  <Input
                    id="max_value"
                    type="number"
                    step="0.01"
                    value={formData.max_value}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        max_value: e.target.value,
                      }))
                    }
                    placeholder="Enter maximum"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium text-red-600">
                Critical Thresholds
              </h4>
              <p className="text-xs text-muted-foreground">
                Optional. Defines extreme boundaries beyond the warning range.
                Critical min must be ≤ warning min, and critical max must be ≥
                warning max. Example: Warning 60–90°F, Critical 40–100°F.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="critical_min">
                    Critical Minimum
                    {formData.sensor_type === 'temperature' &&
                      ` (°${formData.temperature_unit === 'fahrenheit' ? 'F' : 'C'})`}
                    {formData.sensor_type === 'humidity' && ' (%)'}
                  </Label>
                  <Input
                    id="critical_min"
                    type="number"
                    step="0.01"
                    value={formData.critical_min}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        critical_min: e.target.value,
                      }))
                    }
                    placeholder="Below warning min (e.g. 40)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="critical_max">
                    Critical Maximum
                    {formData.sensor_type === 'temperature' &&
                      ` (°${formData.temperature_unit === 'fahrenheit' ? 'F' : 'C'})`}
                    {formData.sensor_type === 'humidity' && ' (%)'}
                  </Label>
                  <Input
                    id="critical_max"
                    type="number"
                    step="0.01"
                    value={formData.critical_max}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        critical_max: e.target.value,
                      }))
                    }
                    placeholder="Above warning max (e.g. 100)"
                  />
                </div>
              </div>
            </div>

            {/* Alert Configuration */}
            <div className="space-y-4 border-t pt-4">
              <h4 className="text-sm font-medium">Alert Configuration</h4>

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
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, alert_enabled: checked }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="alert_severity">Alert Severity</Label>
                <Select
                  value={formData.alert_severity}
                  onValueChange={(value: any) =>
                    setFormData((prev) => ({ ...prev, alert_severity: value }))
                  }
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
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      alert_message: e.target.value,
                    }))
                  }
                  placeholder="Custom alert message"
                />
              </div>
            </div>

            {/* Notification Configuration */}
            <div className="space-y-4 border-t pt-4">
              <h4 className="text-sm font-medium">Notification Settings</h4>

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
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      notify_on_breach: checked,
                    }))
                  }
                />
              </div>

              {formData.notify_on_breach && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="cooldown">
                      Notification Cooldown (minutes)
                    </Label>
                    <Input
                      id="cooldown"
                      type="number"
                      min="1"
                      value={formData.notification_cooldown_minutes}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          notification_cooldown_minutes:
                            parseInt(e.target.value) || 15,
                        }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Minimum time between notifications for the same alert
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Label>Notification Channels</Label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">Email</p>
                            <p className="text-xs text-muted-foreground">
                              Send email notifications
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={formData.notification_channels.includes(
                            'email'
                          )}
                          onCheckedChange={() =>
                            toggleNotificationChannel('email')
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">Slack</p>
                            <p className="text-xs text-muted-foreground">
                              Post to Slack channel
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={formData.notification_channels.includes(
                            'slack'
                          )}
                          onCheckedChange={() =>
                            toggleNotificationChannel('slack')
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          <Bell className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">SMS</p>
                            <p className="text-xs text-muted-foreground">
                              Send text messages
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={formData.notification_channels.includes(
                            'sms'
                          )}
                          onCheckedChange={() =>
                            toggleNotificationChannel('sms')
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Email Recipients - Organization Members */}
                  {formData.notification_channels.includes('email') && (
                    <div className="space-y-3">
                      <Label>Notify Users</Label>
                      <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-2">
                        {members.length === 0 ? (
                          <p className="p-2 text-sm text-muted-foreground">
                            No organization members found
                          </p>
                        ) : (
                          members.map((member) => (
                            <div
                              key={member.id}
                              className="flex items-center justify-between rounded p-2 hover:bg-muted/50"
                            >
                              <div className="flex-1">
                                <p className="text-sm font-medium">
                                  {member.full_name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {member.email}
                                </p>
                              </div>
                              <Switch
                                checked={formData.notify_user_ids.includes(
                                  member.id
                                )}
                                onCheckedChange={() =>
                                  toggleUserNotification(member.id)
                                }
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
                      <Label htmlFor="manual_emails">
                        Additional Email Addresses
                      </Label>
                      <Input
                        id="manual_emails"
                        value={formData.manualEmails}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            manualEmails: e.target.value,
                          }))
                        }
                        placeholder="email1@example.com, email2@example.com"
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter email addresses separated by commas for external
                        contacts
                      </p>
                    </div>
                  )}

                  {/* SMS Phone Numbers */}
                  {formData.notification_channels.includes('sms') && (
                    <div className="space-y-2">
                      <Label htmlFor="manual_phones">SMS Phone Numbers</Label>
                      <Input
                        id="manual_phones"
                        value={formData.manualPhones}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            manualPhones: e.target.value,
                          }))
                        }
                        placeholder="+15551234567, +15559876543"
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter phone numbers in E.164 format (e.g. +15551234567),
                        separated by commas. Requires Twilio configuration in
                        organization settings.
                      </p>
                    </div>
                  )}

                  {/* Slack Info */}
                  {formData.notification_channels.includes('slack') && (
                    <div className="space-y-2 rounded-lg bg-muted/50 p-3">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <MessageSquare className="h-4 w-4" />
                        Slack Notifications
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Slack alerts will be posted to the webhook URL
                        configured in your organization&apos;s notification
                        settings (Settings → Alerts).
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the threshold for{' '}
              <strong>
                {thresholdToDelete?.sensor_type.replace(/_/g, ' ')}
              </strong>
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
