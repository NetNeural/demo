'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Settings, Info, Zap, Wifi, Globe, Loader2 } from 'lucide-react'
import { edgeFunctions } from '@/lib/edge-functions'
import { toast } from 'sonner'

interface NetNeuralHubConfigProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  integrationId?: string
  organizationId?: string
  onSaved: () => void
}

interface ProtocolConfig {
  enabled: boolean
  endpoint: string
  auth?: {
    method: 'psk' | 'certificate' | 'token' | 'none'
    credentials?: Record<string, string>
  }
  options?: {
    // CoAP-specific options
    use_cbor?: boolean
    observe_enabled?: boolean
    dtls_psk?: string
    
    // MQTT-specific options
    default_qos?: 0 | 1 | 2
    command_qos?: 0 | 1 | 2
    retain_telemetry?: boolean
    lwt_enabled?: boolean
    clean_session?: boolean
    keep_alive?: number
    
    // HTTPS-specific options
    webhook_url?: string
    polling_interval_ms?: number
    sse_enabled?: boolean
    require_delivery_receipt?: boolean
    command_timeout_ms?: number
    custom_headers?: Record<string, string>
    user_agent?: string
    
    // Common options
    [key: string]: unknown
  }
}

interface NetNeuralHubConfig {
  name: string
  protocols: {
    coap?: ProtocolConfig
    mqtt?: ProtocolConfig
    https?: ProtocolConfig
  }
  device_routing: {
    [deviceType: string]: {
      preferred_protocols: string[]
      fallback_timeout_ms: number
      capabilities?: string[]
    }
  }
  global_settings: {
    max_retry_attempts: number
    device_discovery_enabled: boolean
    auto_capability_detection: boolean
  }
}

const DEFAULT_CONFIG: NetNeuralHubConfig = {
  name: 'NetNeural Hub Integration',
  protocols: {
    coap: {
      enabled: true,
      endpoint: 'coaps://hub.netneural.io:5684',
      auth: { method: 'psk', credentials: {} },
      options: {
        use_cbor: true,
        observe_enabled: true
      }
    },
    mqtt: {
      enabled: true,
      endpoint: 'mqtts://mqtt.netneural.io:8883',
      auth: { method: 'certificate', credentials: {} },
      options: {
        default_qos: 1,
        command_qos: 2,
        retain_telemetry: false,
        lwt_enabled: true,
        clean_session: false,
        keep_alive: 60
      }
    },
    https: {
      enabled: true,
      endpoint: 'https://api.netneural.io/v1/devices',
      auth: { method: 'token', credentials: {} },
      options: {
        polling_interval_ms: 30000,
        sse_enabled: true,
        require_delivery_receipt: false,
        command_timeout_ms: 30000
      }
    }
  },
  device_routing: {
    'nrf9151_cellular': {
      preferred_protocols: ['coap', 'mqtt', 'https'],
      fallback_timeout_ms: 30000,
      capabilities: ['cellular_connectivity', 'coap_protocol', 'low_power_mode']
    },
    'nrf52840_ble': {
      preferred_protocols: ['mqtt', 'https'],
      fallback_timeout_ms: 15000,
      capabilities: ['ble_connectivity', 'thread_protocol', 'zigbee_protocol']
    },
    'vmark_sensor': {
      preferred_protocols: ['mqtt', 'https'],
      fallback_timeout_ms: 20000,
      capabilities: ['vmark_protocol', 'edge_gateway']
    },
    'universal_sensor_v2': {
      preferred_protocols: ['coap', 'mqtt', 'https'],
      fallback_timeout_ms: 25000,
      capabilities: ['modular_design', 'multi_protocol', 'sensor_array']
    }
  },
  global_settings: {
    max_retry_attempts: 3,
    device_discovery_enabled: true,
    auto_capability_detection: true
  }
}

const DEVICE_TYPES = [
  {
    id: 'nrf9151_cellular',
    name: 'nRF9151 Cellular Gateway',
    description: 'Nordic nRF9151 cellular IoT gateway with LTE-M/NB-IoT',
    icon: <Zap className="h-4 w-4" />,
    protocols: ['coap', 'mqtt', 'https']
  },
  {
    id: 'nrf52840_ble',
    name: 'nRF52840 BLE Device',
    description: 'Nordic nRF52840 BLE/Thread/Zigbee sensor device',
    icon: <Wifi className="h-4 w-4" />,
    protocols: ['mqtt', 'https']
  },
  {
    id: 'vmark_sensor',
    name: 'VMark Protocol Device',
    description: 'NetNeural VMark protocol sensor with edge processing',
    icon: <Settings className="h-4 w-4" />,
    protocols: ['mqtt', 'https']
  },
  {
    id: 'universal_sensor_v2',
    name: 'Universal Sensor 2.0',
    description: 'Modular IoT sensor with interchangeable sensor shoes',
    icon: <Globe className="h-4 w-4" />,
    protocols: ['coap', 'mqtt', 'https']
  }
]

const PROTOCOL_INFO = {
  coap: {
    name: 'CoAP',
    description: 'Constrained Application Protocol - optimized for cellular IoT',
    benefits: ['Ultra low bandwidth', 'Low power consumption', 'Native Nordic SDK support', 'CBOR encoding', 'Observe pattern'],
    defaultPort: 5684,
    icon: <Zap className="h-4 w-4 text-green-500" />,
    features: ['CBOR Support', 'Real-time Observe', 'DTLS Security']
  },
  mqtt: {
    name: 'MQTT',
    description: 'Message Queuing Telemetry Transport - reliable pub/sub messaging',
    benefits: ['Persistent connections', 'QoS levels', 'Existing infrastructure', 'Last Will Testament', 'Retained messages'],
    defaultPort: 8883,
    icon: <Wifi className="h-4 w-4 text-blue-500" />,
    features: ['QoS 0/1/2', 'Last Will Testament', 'Retained Messages']
  },
  https: {
    name: 'HTTPS',
    description: 'HTTP Secure - standard web protocol for REST APIs',
    benefits: ['Easy debugging', 'Universal support', 'Simple implementation', 'WebHook callbacks', 'Server-Sent Events'],
    defaultPort: 443,
    icon: <Globe className="h-4 w-4 text-purple-500" />,
    features: ['WebHook Support', 'Server-Sent Events', 'Custom Headers']
  }
}

export function NetNeuralHubConfigDialog({ 
  open, 
  onOpenChange, 
  integrationId, 
  organizationId, 
  onSaved 
}: NetNeuralHubConfigProps) {
  const [config, setConfig] = useState<NetNeuralHubConfig>(DEFAULT_CONFIG)
  const [activeTab, setActiveTab] = useState('protocols')
  const [isSaving, setIsSaving] = useState(false)

  // Load configuration from localStorage on component mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('netneural-hub-config')
    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig)
        // Merge with defaults to ensure all required fields exist
        setConfig({
          name: parsedConfig.name || DEFAULT_CONFIG.name,
          protocols: parsedConfig.protocols || DEFAULT_CONFIG.protocols,
          device_routing: parsedConfig.device_routing || DEFAULT_CONFIG.device_routing,
          global_settings: parsedConfig.global_settings || DEFAULT_CONFIG.global_settings
        })
      } catch (error) {
        console.warn('Failed to parse saved NetNeural Hub config:', error)
      }
    }
  }, [])

  // Load existing integration configuration if editing
  useEffect(() => {
    const loadExistingConfig = async () => {
      if (integrationId && organizationId) {
        try {
          const response = await edgeFunctions.integrations.list(organizationId)
          if (response.success && response.data) {
            const integrations = (response.data as any)?.integrations || []
            const existingIntegration = integrations.find((i: any) => i.id === integrationId)
            
            if (existingIntegration && existingIntegration.settings) {
              setConfig({
                name: existingIntegration.name || DEFAULT_CONFIG.name,
                protocols: existingIntegration.settings.protocols || DEFAULT_CONFIG.protocols,
                device_routing: existingIntegration.settings.device_routing || DEFAULT_CONFIG.device_routing,
                global_settings: existingIntegration.settings.global_settings || DEFAULT_CONFIG.global_settings
              })
            }
          }
        } catch (error) {
          console.warn('Failed to load existing NetNeural Hub config:', error)
        }
      }
    }

    if (open) {
      loadExistingConfig()
    }
  }, [integrationId, organizationId, open])

  const updateProtocolConfig = (protocol: string, updates: Partial<ProtocolConfig>) => {
    setConfig(prev => ({
      ...prev,
      protocols: {
        ...prev.protocols,
        [protocol]: {
          ...prev.protocols[protocol as keyof typeof prev.protocols],
          ...updates
        }
      }
    }))
  }

  const updateDeviceRouting = (deviceType: string, updates: Partial<NetNeuralHubConfig['device_routing'][string]>) => {
    setConfig(prev => ({
      ...prev,
      device_routing: {
        ...prev.device_routing,
        [deviceType]: {
          ...prev.device_routing[deviceType],
          ...updates
        } as NetNeuralHubConfig['device_routing'][string]
      }
    }))
  }

  const handleSave = async () => {
    // Validate required fields
    if (!config.name?.trim()) {
      toast.error('Please enter an integration name')
      return
    }
    
    if (!organizationId) {
      toast.error('Organization ID is required')
      return
    }

    // Configuration validation
    if (!config.protocols || Object.keys(config.protocols).length === 0) {
      toast.error('At least one protocol must be configured')
      return
    }

    setIsSaving(true)
    try {
      if (integrationId) {
        // Update existing integration
        const response = await edgeFunctions.integrations.update(integrationId, {
          name: config.name,
          settings: {
            protocols: config.protocols,
            device_routing: config.device_routing,
            global_settings: config.global_settings
          }
        })

        if (!response.success) {
          throw new Error(response.error?.message || 'Failed to update integration')
        }
      } else {
        // Create new integration
        const response = await edgeFunctions.integrations.create({
          organization_id: organizationId,
          integration_type: 'netneural_hub',
          name: config.name,
          settings: {
            protocols: config.protocols,
            device_routing: config.device_routing,
            global_settings: config.global_settings
          }
        } as any)

        if (!response.success) {
          let errorMsg = response.error?.message || 'Failed to create integration'
          
          if (errorMsg.includes('duplicate key') || errorMsg.includes('unique constraint')) {
            errorMsg = `An integration with the name "${config.name}" already exists. Please choose a different name.`
          }
          
          throw new Error(errorMsg)
        }
      }
      
      // Also store in localStorage for quick access
      localStorage.setItem('netneural-hub-config', JSON.stringify(config))
      
      toast.success('NetNeural Hub configuration saved successfully')
      onSaved()
      onOpenChange(false)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save configuration'
      toast.error(errorMessage)
      console.error('Failed to save NetNeural Hub config:', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            NetNeural Hub Configuration
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Hub Integration Brief */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>NetNeural Hub:</strong> Auto-discovers devices via CoAP, MQTT, or HTTPS. No manual registration required.
            </AlertDescription>
          </Alert>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="protocols">Protocol Configuration</TabsTrigger>
              <TabsTrigger value="routing">Device Routing</TabsTrigger>
              <TabsTrigger value="settings">Global Settings</TabsTrigger>
            </TabsList>

            {/* Protocol Configuration Tab */}
            <TabsContent value="protocols" className="space-y-6">
              <Tabs defaultValue="coap" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  {Object.entries(PROTOCOL_INFO).map(([protocolKey, info]) => (
                    <TabsTrigger key={protocolKey} value={protocolKey} className="flex items-center gap-2">
                      {info.icon}
                      {info.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
                
                {Object.entries(PROTOCOL_INFO).map(([protocolKey, info]) => {
                  const protocolConfig = config.protocols[protocolKey as keyof typeof config.protocols]
                  
                  return (
                    <TabsContent key={protocolKey} value={protocolKey} className="space-y-4">
                      <Card>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {info.icon}
                              <div>
                                <CardTitle className="text-lg">{info.name}</CardTitle>
                                <CardDescription>{info.description}</CardDescription>
                              </div>
                            </div>
                            <Switch
                              checked={protocolConfig?.enabled || false}
                              onCheckedChange={(enabled) => updateProtocolConfig(protocolKey, { enabled })}
                            />
                          </div>
                          {protocolConfig?.enabled && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {info.benefits.map((benefit, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {benefit}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </CardHeader>
                        
                        {protocolConfig?.enabled && (
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor={`${protocolKey}-endpoint`}>Endpoint URL</Label>
                                <Input
                                  id={`${protocolKey}-endpoint`}
                                  value={protocolConfig?.endpoint || ''}
                                  onChange={(e) => updateProtocolConfig(protocolKey, { endpoint: e.target.value })}
                                  placeholder={`${protocolKey}s://your-domain.com:${info.defaultPort}`}
                                />
                              </div>
                              <div>
                                <Label htmlFor={`${protocolKey}-auth`}>Authentication Method</Label>
                                <Select
                                  value={protocolConfig?.auth?.method || 'none'}
                                  onValueChange={(method) => 
                                    updateProtocolConfig(protocolKey, {
                                      auth: { 
                                        ...protocolConfig?.auth, 
                                        method: method as 'psk' | 'certificate' | 'token' | 'none' 
                                      }
                                    })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">No Authentication</SelectItem>
                                    <SelectItem value="psk">Pre-Shared Key</SelectItem>
                                    <SelectItem value="certificate">X.509 Certificate</SelectItem>
                                    <SelectItem value="token">Bearer Token</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            
                            {/* Protocol-Specific Options */}
                            {protocolKey === 'coap' && (
                              <div className="space-y-3 border-t pt-4">
                                <h4 className="font-medium text-sm">CoAP Options</h4>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="flex items-center justify-between">
                                    <Label>CBOR Encoding</Label>
                                    <Switch
                                      checked={protocolConfig?.options?.use_cbor || false}
                                      onCheckedChange={(enabled) => updateProtocolConfig(protocolKey, {
                                        options: { ...protocolConfig?.options, use_cbor: enabled }
                                      })}
                                    />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <Label>Observe Pattern</Label>
                                    <Switch
                                      checked={protocolConfig?.options?.observe_enabled || false}
                                      onCheckedChange={(enabled) => updateProtocolConfig(protocolKey, {
                                        options: { ...protocolConfig?.options, observe_enabled: enabled }
                                      })}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {protocolKey === 'mqtt' && (
                              <div className="space-y-3 border-t pt-4">
                                <h4 className="font-medium text-sm">MQTT Options</h4>
                                <div className="grid grid-cols-3 gap-4">
                                  <div>
                                    <Label>Default QoS</Label>
                                    <Select
                                      value={String(protocolConfig?.options?.default_qos || 1)}
                                      onValueChange={(qos) => updateProtocolConfig(protocolKey, {
                                        options: { ...protocolConfig?.options, default_qos: parseInt(qos) as 0 | 1 | 2 }
                                      })}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="0">QoS 0 (At most once)</SelectItem>
                                        <SelectItem value="1">QoS 1 (At least once)</SelectItem>
                                        <SelectItem value="2">QoS 2 (Exactly once)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <Label>Retain Telemetry</Label>
                                    <Switch
                                      checked={protocolConfig?.options?.retain_telemetry || false}
                                      onCheckedChange={(enabled) => updateProtocolConfig(protocolKey, {
                                        options: { ...protocolConfig?.options, retain_telemetry: enabled }
                                      })}
                                    />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <Label>Last Will Testament</Label>
                                    <Switch
                                      checked={protocolConfig?.options?.lwt_enabled || false}
                                      onCheckedChange={(enabled) => updateProtocolConfig(protocolKey, {
                                        options: { ...protocolConfig?.options, lwt_enabled: enabled }
                                      })}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {protocolKey === 'https' && (
                              <div className="space-y-3 border-t pt-4">
                                <h4 className="font-medium text-sm">HTTPS Options</h4>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>WebHook URL</Label>
                                    <Input
                                      value={protocolConfig?.options?.webhook_url || ''}
                                      onChange={(e) => updateProtocolConfig(protocolKey, {
                                        options: { ...protocolConfig?.options, webhook_url: e.target.value }
                                      })}
                                      placeholder="https://your-domain.com/webhook"
                                    />
                                  </div>
                                  <div>
                                    <Label>Polling Interval (ms)</Label>
                                    <Input
                                      type="number"
                                      value={protocolConfig?.options?.polling_interval_ms || 30000}
                                      onChange={(e) => updateProtocolConfig(protocolKey, {
                                        options: { ...protocolConfig?.options, polling_interval_ms: parseInt(e.target.value) }
                                      })}
                                      min={5000}
                                      max={300000}
                                    />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <Label>Server-Sent Events</Label>
                                    <Switch
                                      checked={protocolConfig?.options?.sse_enabled || false}
                                      onCheckedChange={(enabled) => updateProtocolConfig(protocolKey, {
                                        options: { ...protocolConfig?.options, sse_enabled: enabled }
                                      })}
                                    />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <Label>Delivery Receipts</Label>
                                    <Switch
                                      checked={protocolConfig?.options?.require_delivery_receipt || false}
                                      onCheckedChange={(enabled) => updateProtocolConfig(protocolKey, {
                                        options: { ...protocolConfig?.options, require_delivery_receipt: enabled }
                                      })}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {protocolConfig?.auth?.method !== 'none' && (
                              <Alert>
                                <Info className="h-4 w-4" />
                                <AlertDescription>
                                  {protocolKey.toUpperCase()} authentication credentials will be configured in production deployment.
                                  Development uses demo credentials from local environment.
                                </AlertDescription>
                              </Alert>
                            )}
                          </CardContent>
                        )}
                      </Card>
                    </TabsContent>
                  )
                })}
              </Tabs>
            </TabsContent>

            {/* Device Routing Tab */}
            <TabsContent value="routing" className="space-y-6">
              <div>
                <h3 className="text-lg font-medium">Device Type Routing</h3>
                <p className="text-sm text-muted-foreground">
                  Configure protocol preferences for each device type
                </p>
              </div>

              <Tabs defaultValue={DEVICE_TYPES[0]?.id} className="space-y-6">
                <TabsList className="grid w-full grid-cols-4">
                  {DEVICE_TYPES.map((deviceType) => (
                    <TabsTrigger key={deviceType.id} value={deviceType.id} className="flex items-center gap-2">
                      {deviceType.icon}
                      <span className="hidden sm:inline">{deviceType.name.split(' ')[0]}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>

                {DEVICE_TYPES.map((deviceType) => {
                  const routing = config.device_routing[deviceType.id]
                  if (!routing) return null

                  return (
                    <TabsContent key={deviceType.id} value={deviceType.id} className="space-y-4">
                      <Card>
                        <CardHeader>
                          <div className="flex items-center gap-3">
                            {deviceType.icon}
                            <div>
                              <CardTitle className="text-lg">{deviceType.name}</CardTitle>
                              <CardDescription>{deviceType.description}</CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          <div>
                            <Label className="text-base font-medium">Protocol Preference Order</Label>
                            <p className="text-sm text-muted-foreground mb-4">
                              Click protocols to set preference order. Lower numbers have higher priority.
                            </p>
                            <div className="flex flex-wrap gap-3">
                              {deviceType.protocols.map((protocol) => {
                                const isSelected = routing.preferred_protocols.includes(protocol)
                                const priority = routing.preferred_protocols.indexOf(protocol) + 1
                                
                                return (
                                  <Button
                                    key={protocol}
                                    variant={isSelected ? "default" : "outline"}
                                    size="lg"
                                    onClick={() => {
                                      const newProtocols = isSelected
                                        ? routing.preferred_protocols.filter(p => p !== protocol)
                                        : [...routing.preferred_protocols, protocol]
                                      updateDeviceRouting(deviceType.id, { preferred_protocols: newProtocols })
                                    }}
                                    className="relative"
                                  >
                                    {protocol.toUpperCase()}
                                    {isSelected && (
                                      <Badge className="ml-2 h-5 w-5 text-xs flex items-center justify-center">
                                        {priority}
                                      </Badge>
                                    )}
                                  </Button>
                                )
                              })}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-6">
                            <div>
                              <Label htmlFor={`${deviceType.id}-timeout`} className="text-base font-medium">
                                Fallback Timeout (ms)
                              </Label>
                              <p className="text-sm text-muted-foreground mb-2">
                                Time to wait before switching to next protocol
                              </p>
                              <Input
                                id={`${deviceType.id}-timeout`}
                                type="number"
                                value={routing.fallback_timeout_ms}
                                onChange={(e) => 
                                  updateDeviceRouting(deviceType.id, {
                                    fallback_timeout_ms: parseInt(e.target.value) || 30000
                                  })
                                }
                                className="w-full"
                                min="1000"
                                max="300000"
                                step="1000"
                              />
                            </div>
                            
                            <div>
                              <Label className="text-base font-medium">Selected Protocols</Label>
                              <p className="text-sm text-muted-foreground mb-2">
                                Active protocols in priority order
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {routing.preferred_protocols.length > 0 ? (
                                  routing.preferred_protocols.map((protocol, index) => (
                                    <Badge key={protocol} variant="secondary" className="text-sm">
                                      {index + 1}. {protocol.toUpperCase()}
                                    </Badge>
                                  ))
                                ) : (
                                  <Badge variant="outline" className="text-sm">
                                    No protocols selected
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  )
                })}
              </Tabs>
            </TabsContent>

            {/* Global Settings Tab */}
            <TabsContent value="settings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Integration Details</CardTitle>
                  <CardDescription>
                    Configure the integration name and global behavior settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Integration Name */}
                  <div className="space-y-2">
                    <Label htmlFor="integration-name">Integration Name *</Label>
                    <Input
                      id="integration-name"
                      value={config.name || ''}
                      onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter a name for this NetNeural Hub integration"
                      required
                    />
                  </div>
                  
                  <div className="border-t pt-6">
                    <h4 className="text-sm font-medium mb-4">Global Hub Settings</h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="max-retries">Maximum Retry Attempts</Label>
                        <Input
                          id="max-retries"
                          type="number"
                          value={config.global_settings.max_retry_attempts}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            global_settings: {
                              ...prev.global_settings,
                              max_retry_attempts: parseInt(e.target.value) || 3
                            }
                          }))}
                          min={1}
                          max={10}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Device Discovery</Label>
                          <p className="text-sm text-muted-foreground">
                            Automatically discover and register new devices
                          </p>
                        </div>
                        <Switch
                          checked={config.global_settings.device_discovery_enabled}
                          onCheckedChange={(enabled) => setConfig(prev => ({
                            ...prev,
                            global_settings: {
                              ...prev.global_settings,
                              device_discovery_enabled: enabled
                            }
                          }))}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Auto Capability Detection</Label>
                          <p className="text-sm text-muted-foreground">
                            Automatically detect device capabilities from metadata
                          </p>
                        </div>
                        <Switch
                          checked={config.global_settings.auto_capability_detection}
                          onCheckedChange={(enabled) => setConfig(prev => ({
                            ...prev,
                            global_settings: {
                              ...prev.global_settings,
                              auto_capability_detection: enabled
                            }
                          }))}
                        />
                      </div>
                    </div>
                  </div>
                  </div>
                </CardContent>
              </Card>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  NetNeural Hub supports seamless addition of new device types and protocols.
                  Contact support for assistance with custom device integrations.
                </AlertDescription>
              </Alert>
            </TabsContent>
          </Tabs>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !config.name?.trim()}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                integrationId ? 'Update Integration' : 'Create Integration'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}