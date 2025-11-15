// ===========================================================================
// NetNeural Hub Client - Multi-Protocol Integration Client
// ===========================================================================
// Extensible integration client for NetNeural custom devices
// Supports multiple protocols (CoAP, MQTT, HTTPS) and device types
// Automatically routes devices based on capabilities and configuration
//
// Features:
// - Protocol abstraction layer for CoAP, MQTT, HTTPS
// - Device-specific adapters (nRF9151, nRF52840, Universal Sensor 2.0, VMark)
// - Auto-discovery of device capabilities
// - Seamless addition of new device types
// - Unified device lifecycle management
// ===========================================================================

import { BaseIntegrationClient, IntegrationConfig, TestResult, SyncResult, Device, IntegrationError } from './base-integration-client.ts'

// ===========================================================================
// Protocol Handler Types
// ===========================================================================

export interface ProtocolConfig {
  enabled: boolean
  endpoint: string
  auth?: {
    method: 'psk' | 'certificate' | 'token' | 'none'
    credentials?: Record<string, string>
  }
  options?: Record<string, unknown>
}

export interface DeviceCapability {
  device_type: string
  capability: string
  metadata: Record<string, unknown>
}

export interface NetNeuralHubConfig {
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

// ===========================================================================
// Abstract Protocol Handler
// ===========================================================================

export abstract class ProtocolHandler {
  protected config: ProtocolConfig
  
  constructor(config: ProtocolConfig) {
    this.config = config
  }
  
  abstract test(): Promise<TestResult>
  abstract sendTelemetry(deviceId: string, data: Record<string, unknown>): Promise<boolean>
  abstract getDevices(): Promise<Device[]>
  abstract sendCommand(deviceId: string, command: Record<string, unknown>): Promise<boolean>
  abstract subscribe(deviceId: string, callback: (data: Record<string, unknown>) => void): Promise<void>
}

// ===========================================================================
// CoAP Protocol Handler
// ===========================================================================

export class CoapProtocolHandler extends ProtocolHandler {
  private observeConnections: Map<string, WebSocket> = new Map()
  
  async test(): Promise<TestResult> {
    try {
      // Test CoAP endpoint connectivity
      const response = await fetch(`${this.config.endpoint}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })
      
      const details = {
        endpoint: this.config.endpoint,
        status: response.status,
        dtls_enabled: this.config.endpoint.startsWith('coaps://'),
        observe_support: this.config.options?.observe_enabled || false
      }
      
      return {
        success: response.ok,
        message: response.ok ? 'CoAP endpoint reachable' : `CoAP endpoint error: ${response.status}`,
        details
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        success: false,
        message: `CoAP connection failed: ${errorMessage}`,
        details: { endpoint: this.config.endpoint, error: errorMessage }
      }
    }
  }
  
  async sendTelemetry(deviceId: string, data: Record<string, unknown>): Promise<boolean> {
    try {
      const payload = {
        device_id: deviceId,
        timestamp: new Date().toISOString(),
        data
      }
      
      // Use CBOR encoding if configured, otherwise JSON fallback
      const contentType = this.config.options?.use_cbor ? 'application/cbor' : 'application/json'
      const body = this.config.options?.use_cbor 
        ? this.encodeCBOR(payload)
        : JSON.stringify(payload)
      
      const response = await fetch(`${this.config.endpoint}/v1/devices/${deviceId}/telemetry`, {
        method: 'POST',
        headers: {
          'Content-Type': contentType,
          'X-Protocol': 'coap',
          'Accept': 'application/json'
        },
        body
      })
      
      return response.ok
    } catch (error) {
      console.error(`[CoapHandler] Telemetry send failed for ${deviceId}:`, error)
      return false
    }
  }
  
  async getDevices(): Promise<Device[]> {
    try {
      const response = await fetch(`${this.config.endpoint}/v1/devices`, {
        headers: { 'X-Protocol': 'coap' }
      })
      
      if (!response.ok) return []
      
      const data = await response.json()
      return data.devices || []
    } catch (error) {
      console.error('[CoapHandler] Get devices failed:', error)
      return []
    }
  }
  
  async sendCommand(deviceId: string, command: Record<string, unknown>): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.endpoint}/v1/devices/${deviceId}/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Protocol': 'coap'
        },
        body: JSON.stringify(command)
      })
      
      return response.ok
    } catch (error) {
      console.error(`[CoapHandler] Command send failed for ${deviceId}:`, error)
      return false
    }
  }
  
  async subscribe(deviceId: string, callback: (data: Record<string, unknown>) => void): Promise<void> {
    if (!this.config.options?.observe_enabled) {
      console.warn(`[CoapHandler] Observe not enabled for ${deviceId}`)
      return
    }
    
    try {
      // Use WebSocket for CoAP observe pattern
      const wsUrl = this.config.endpoint.replace(/^coaps?:\/\//, 'wss://').replace(/^coap:\/\//, 'ws://')
      const ws = new WebSocket(`${wsUrl}/v1/devices/${deviceId}/observe`)
      
      ws.onopen = () => {
        // CoAP observe connection established
        // Send observe request
        ws.send(JSON.stringify({ 
          type: 'observe', 
          resource: `/devices/${deviceId}/telemetry`,
          token: this.config.auth?.credentials?.psk || ''
        }))
      }
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          if (message.type === 'notification') {
            callback(message.payload)
          }
        } catch (error) {
          console.error(`[CoapHandler] Failed to parse observe message:`, error)
        }
      }
      
      ws.onerror = (error) => {
        console.error(`[CoapHandler] Observe connection error for ${deviceId}:`, error)
      }
      
      ws.onclose = () => {
        // CoAP observe connection closed
        this.observeConnections.delete(deviceId)
      }
      
      this.observeConnections.set(deviceId, ws)
    } catch (error) {
      console.error(`[CoapHandler] Failed to establish observe for ${deviceId}:`, error)
    }
  }
  
  // CBOR encoding helper (basic implementation)
  private encodeCBOR(data: any): ArrayBuffer {
    // Simple CBOR encoding for basic types
    // In production, use a proper CBOR library like 'cbor-js'
    const json = JSON.stringify(data)
    const encoder = new TextEncoder()
    return encoder.encode(json)
  }
  
  // CBOR decoding helper
  private decodeCBOR(buffer: ArrayBuffer): any {
    // Simple CBOR decoding fallback to JSON
    // In production, use a proper CBOR library
    const decoder = new TextDecoder()
    const json = decoder.decode(buffer)
    return JSON.parse(json)
  }
  
  // Clean up observe connections
  public cleanup(): void {
    for (const [deviceId, ws] of this.observeConnections) {
      ws.close()
      // CoAP observe connection cleaned up
    }
    this.observeConnections.clear()
  }
}

// ===========================================================================
// MQTT Protocol Handler
// ===========================================================================

export class MqttProtocolHandler extends ProtocolHandler {
  private mqttConnections: Map<string, WebSocket> = new Map()
  
  async test(): Promise<TestResult> {
    try {
      // Test MQTT broker connectivity via HTTP bridge
      const response = await fetch(`${this.config.endpoint}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })
      
      const details = {
        endpoint: this.config.endpoint,
        status: response.status,
        qos_levels: this.config.options?.qos_levels || [0, 1, 2],
        retained_messages: this.config.options?.retained_enabled || false,
        lwt_enabled: this.config.options?.lwt_enabled || false
      }
      
      return {
        success: response.ok,
        message: response.ok ? 'MQTT broker reachable' : `MQTT broker error: ${response.status}`,
        details
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        success: false,
        message: `MQTT connection failed: ${errorMessage}`,
        details: { endpoint: this.config.endpoint, error: errorMessage }
      }
    }
  }
  
  async sendTelemetry(deviceId: string, data: Record<string, unknown>): Promise<boolean> {
    try {
      // Get QoS level from config (default: 1)
      const qos = this.config.options?.default_qos || 1
      const retained = this.config.options?.retain_telemetry || false
      
      // Send via MQTT-HTTP bridge with QoS support
      const response = await fetch(`${this.config.endpoint}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Protocol': 'mqtt',
          'Authorization': this.config.auth?.credentials?.token ? `Bearer ${this.config.auth.credentials.token}` : ''
        },
        body: JSON.stringify({
          topic: `netneural/devices/${deviceId}/telemetry`,
          qos,
          retain: retained,
          payload: {
            device_id: deviceId,
            timestamp: new Date().toISOString(),
            data
          }
        })
      })
      
      return response.ok
    } catch (error) {
      console.error(`[MqttHandler] Telemetry send failed for ${deviceId}:`, error)
      return false
    }
  }
  
  async getDevices(): Promise<Device[]> {
    try {
      // Get devices via MQTT retained messages or HTTP API
      const response = await fetch(`${this.config.endpoint}/devices`, {
        headers: { 'X-Protocol': 'mqtt' }
      })
      
      if (!response.ok) return []
      
      const data = await response.json()
      return data.devices || []
    } catch (error) {
      console.error('[MqttHandler] Get devices failed:', error)
      return []
    }
  }
  
  async sendCommand(deviceId: string, command: Record<string, unknown>): Promise<boolean> {
    try {
      // Use higher QoS for commands to ensure delivery
      const qos = this.config.options?.command_qos || 2
      
      const response = await fetch(`${this.config.endpoint}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Protocol': 'mqtt',
          'Authorization': this.config.auth?.credentials?.token ? `Bearer ${this.config.auth.credentials.token}` : ''
        },
        body: JSON.stringify({
          topic: `netneural/devices/${deviceId}/commands`,
          qos,
          retain: false, // Commands should not be retained
          payload: {
            ...command,
            timestamp: new Date().toISOString(),
            command_id: crypto.randomUUID()
          }
        })
      })
      
      return response.ok
    } catch (error) {
      console.error(`[MqttHandler] Command send failed for ${deviceId}:`, error)
      return false
    }
  }
  
  async subscribe(deviceId: string, callback: (data: Record<string, unknown>) => void): Promise<void> {
    try {
      // Use WebSocket MQTT client for real-time subscriptions
      const wsUrl = this.config.endpoint.replace(/^mqtts?:\/\//, 'wss://').replace(/^mqtt:\/\//, 'ws://')
      const ws = new WebSocket(`${wsUrl}/mqtt`)
      
      ws.onopen = () => {
        // MQTT WebSocket connection established
        
        // Subscribe to device topics with appropriate QoS
        const subscriptions = [
          { topic: `netneural/devices/${deviceId}/telemetry`, qos: 1 },
          { topic: `netneural/devices/${deviceId}/status`, qos: 1 },
          { topic: `netneural/devices/${deviceId}/alerts`, qos: 2 }
        ]
        
        ws.send(JSON.stringify({
          type: 'subscribe',
          subscriptions,
          client_id: `netneural_hub_${deviceId}_${Date.now()}`,
          clean_session: false,
          keep_alive: 60
        }))
      }
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          if (message.type === 'message' && message.topic.includes(deviceId)) {
            callback({
              topic: message.topic,
              payload: message.payload,
              qos: message.qos,
              retain: message.retain,
              timestamp: new Date().toISOString()
            })
          }
        } catch (error) {
          console.error(`[MqttHandler] Failed to parse MQTT message:`, error)
        }
      }
      
      ws.onerror = (error) => {
        console.error(`[MqttHandler] WebSocket MQTT connection error for ${deviceId}:`, error)
      }
      
      ws.onclose = () => {
        // MQTT WebSocket connection closed
        this.mqttConnections.delete(deviceId)
      }
      
      this.mqttConnections.set(deviceId, ws)
    } catch (error) {
      console.error(`[MqttHandler] Failed to establish MQTT subscription for ${deviceId}:`, error)
    }
  }
  
  // Configure Last Will and Testament for device
  public configureLWT(deviceId: string): Record<string, unknown> {
    if (!this.config.options?.lwt_enabled) {
      return {}
    }
    
    return {
      lwt_topic: `netneural/devices/${deviceId}/status`,
      lwt_message: JSON.stringify({
        device_id: deviceId,
        status: 'offline',
        timestamp: new Date().toISOString(),
        reason: 'connection_lost'
      }),
      lwt_qos: 1,
      lwt_retain: true
    }
  }
  
  // Clean up MQTT connections
  public cleanup(): void {
    for (const [deviceId, ws] of this.mqttConnections) {
      ws.close()
      // MQTT connection cleaned up
    }
    this.mqttConnections.clear()
  }
}

// ===========================================================================
// HTTPS Protocol Handler
// ===========================================================================

export class HttpsProtocolHandler extends ProtocolHandler {
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map()
  private sseConnections: Map<string, EventSource> = new Map()
  
  async test(): Promise<TestResult> {
    try {
      const customHeaders = this.buildCustomHeaders()
      const response = await fetch(`${this.config.endpoint}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
        headers: customHeaders
      })
      
      const details = {
        endpoint: this.config.endpoint,
        status: response.status,
        webhook_enabled: !!this.config.options?.webhook_url,
        polling_interval: this.config.options?.polling_interval_ms || 30000,
        sse_enabled: this.config.options?.sse_enabled || false,
        custom_headers: Object.keys(customHeaders).length
      }
      
      return {
        success: response.ok,
        message: response.ok ? 'HTTPS endpoint reachable' : `HTTPS endpoint error: ${response.status}`,
        details
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        success: false,
        message: `HTTPS connection failed: ${errorMessage}`,
        details: { endpoint: this.config.endpoint, error: errorMessage }
      }
    }
  }
  
  async sendTelemetry(deviceId: string, data: Record<string, unknown>): Promise<boolean> {
    try {
      const customHeaders = this.buildCustomHeaders()
      const response = await fetch(`${this.config.endpoint}/v1/devices/${deviceId}/telemetry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.config.auth?.credentials?.token ? `Bearer ${this.config.auth.credentials.token}` : '',
          'X-Protocol': 'https',
          'X-Device-ID': deviceId,
          ...customHeaders
        },
        body: JSON.stringify({
          device_id: deviceId,
          timestamp: new Date().toISOString(),
          data,
          callback_url: this.config.options?.webhook_url || null,
          delivery_receipt: this.config.options?.require_delivery_receipt || false
        })
      })
      
      return response.ok
    } catch (error) {
      console.error(`[HttpsHandler] Telemetry send failed for ${deviceId}:`, error)
      return false
    }
  }
  
  async getDevices(): Promise<Device[]> {
    try {
      const response = await fetch(`${this.config.endpoint}/v1/devices`, {
        headers: {
          'Authorization': this.config.auth?.credentials?.token ? `Bearer ${this.config.auth.credentials.token}` : '',
          'X-Protocol': 'https'
        }
      })
      
      if (!response.ok) return []
      
      const data = await response.json()
      return data.devices || []
    } catch (error) {
      console.error('[HttpsHandler] Get devices failed:', error)
      return []
    }
  }
  
  async sendCommand(deviceId: string, command: Record<string, unknown>): Promise<boolean> {
    try {
      const customHeaders = this.buildCustomHeaders()
      const response = await fetch(`${this.config.endpoint}/v1/devices/${deviceId}/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.config.auth?.credentials?.token ? `Bearer ${this.config.auth.credentials.token}` : '',
          'X-Protocol': 'https',
          'X-Device-ID': deviceId,
          'X-Command-ID': crypto.randomUUID(),
          ...customHeaders
        },
        body: JSON.stringify({
          ...command,
          timestamp: new Date().toISOString(),
          callback_url: this.config.options?.webhook_url || null,
          timeout_ms: this.config.options?.command_timeout_ms || 30000
        })
      })
      
      return response.ok
    } catch (error) {
      console.error(`[HttpsHandler] Command send failed for ${deviceId}:`, error)
      return false
    }
  }
  
  async subscribe(deviceId: string, callback: (data: Record<string, unknown>) => void): Promise<void> {
    // Try Server-Sent Events first, fallback to polling
    if (this.config.options?.sse_enabled) {
      this.subscribeSSE(deviceId, callback)
    } else {
      this.subscribePolling(deviceId, callback)
    }
  }
  
  private subscribeSSE(deviceId: string, callback: (data: Record<string, unknown>) => void): void {
    try {
      const sseUrl = `${this.config.endpoint}/v1/devices/${deviceId}/events`
      const eventSource = new EventSource(sseUrl)
      
      eventSource.onopen = () => {
        // HTTPS SSE connection established
      }
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          callback({
            type: 'sse_message',
            device_id: deviceId,
            data,
            timestamp: new Date().toISOString()
          })
        } catch (error) {
          console.error(`[HttpsHandler] Failed to parse SSE message:`, error)
        }
      }
      
      eventSource.onerror = (error) => {
        console.error(`[HttpsHandler] SSE connection error for ${deviceId}:`, error)
        // Fallback to polling on SSE failure
        this.subscribePolling(deviceId, callback)
      }
      
      this.sseConnections.set(deviceId, eventSource)
    } catch (error) {
      console.error(`[HttpsHandler] Failed to establish SSE for ${deviceId}:`, error)
      this.subscribePolling(deviceId, callback)
    }
  }
  
  private subscribePolling(deviceId: string, callback: (data: Record<string, unknown>) => void): void {
    const interval = this.config.options?.polling_interval_ms || 30000
    
    const pollData = async () => {
      try {
        const customHeaders = this.buildCustomHeaders()
        const response = await fetch(`${this.config.endpoint}/v1/devices/${deviceId}/status`, {
          headers: {
            'Authorization': this.config.auth?.credentials?.token ? `Bearer ${this.config.auth.credentials.token}` : '',
            'X-Protocol': 'https',
            ...customHeaders
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          callback({
            type: 'polling_update',
            device_id: deviceId,
            data,
            timestamp: new Date().toISOString()
          })
        }
      } catch (error) {
        console.error(`[HttpsHandler] Polling failed for ${deviceId}:`, error)
      }
    }
    
    // Initial poll
    pollData()
    
    // Set up interval
    const intervalMs = Number(interval) || 30000
    const intervalId = setInterval(pollData, intervalMs)
    this.pollingIntervals.set(deviceId, intervalId)
    
    // Started polling interval
  }
  
  // Build custom headers from configuration
  private buildCustomHeaders(): Record<string, string> {
    const headers: Record<string, string> = {}
    
    // Add configured custom headers
    if (this.config.options?.custom_headers) {
      Object.assign(headers, this.config.options.custom_headers)
    }
    
    // Add user agent if configured
    if (this.config.options?.user_agent && typeof this.config.options.user_agent === 'string') {
      headers['User-Agent'] = this.config.options.user_agent
    }
    
    return headers
  }
  
  // Clean up connections and intervals
  public cleanup(): void {
    // Clean up polling intervals
    for (const [_deviceId, intervalId] of this.pollingIntervals) {
      clearInterval(intervalId)
      // Polling cleaned up
    }
    this.pollingIntervals.clear()
    
    // Clean up SSE connections
    for (const [_deviceId, eventSource] of this.sseConnections) {
      eventSource.close()
      // SSE connection cleaned up
    }
    this.sseConnections.clear()
  }
}

// ===========================================================================
// Device Type Adapters
// ===========================================================================

export abstract class DeviceAdapter {
  abstract deviceType: string
  abstract supportedProtocols: string[]
  
  abstract normalizeDevice(rawDevice: Record<string, unknown>): Device
  abstract prepareCommand(command: Record<string, unknown>): Record<string, unknown>
  abstract parseTelemetry(data: Record<string, unknown>): Record<string, unknown>
}

// nRF9151 Cellular Gateway Adapter
export class Nrf9151CellularAdapter extends DeviceAdapter {
  deviceType = 'nrf9151_cellular'
  supportedProtocols = ['coap', 'mqtt', 'https']
  
  normalizeDevice(rawDevice: Record<string, unknown>): Device {
    return {
      id: rawDevice.id as string || crypto.randomUUID(),
      name: rawDevice.name as string || `nRF9151-${rawDevice.hardware_id}`,
      hardware_id: rawDevice.hardware_id as string,
      status: this.mapStatus(rawDevice.status as string),
      last_seen: rawDevice.lastReport as string,
      metadata: {
        device_type: this.deviceType,
        firmware_version: (rawDevice.metadata as any)?.update?.['cellgateway-nrf9151-firmware']?.version,
        cellular_info: {
          rssi: (rawDevice.metadata as any)?.rssi,
          band: (rawDevice.metadata as any)?.band,
          operator: (rawDevice.metadata as any)?.operator
        },
        ...rawDevice.metadata as Record<string, unknown>
      }
    }
  }
  
  prepareCommand(command: Record<string, unknown>): Record<string, unknown> {
    // nRF9151 specific command format
    return {
      type: command.type,
      params: command.params,
      timestamp: new Date().toISOString(),
      target: 'cellgateway-nrf9151-firmware'
    }
  }
  
  parseTelemetry(data: Record<string, unknown>): Record<string, unknown> {
    return {
      temperature: data.temperature,
      rssi: data.rssi,
      battery_voltage: data.battery,
      signal_strength: data.signal,
      location: data.gps,
      uptime: data.uptime,
      firmware_version: data.firmware
    }
  }
  
  private mapStatus(status: string): Device['status'] {
    switch (status) {
      case 'online': return 'online'
      case 'offline': return 'offline'
      case '-': return 'unknown'
      default: return 'unknown'
    }
  }
}

// nRF52840 BLE Adapter
export class Nrf52840BleAdapter extends DeviceAdapter {
  deviceType = 'nrf52840_ble'
  supportedProtocols = ['mqtt', 'https'] // BLE devices typically go through gateways
  
  normalizeDevice(rawDevice: Record<string, unknown>): Device {
    return {
      id: rawDevice.id as string || crypto.randomUUID(),
      name: rawDevice.name as string || `nRF52840-${rawDevice.hardware_id}`,
      hardware_id: rawDevice.hardware_id as string,
      status: this.mapStatus(rawDevice.status as string),
      last_seen: rawDevice.lastReport as string,
      metadata: {
        device_type: this.deviceType,
        firmware_version: (rawDevice.metadata as any)?.update?.['test-bleconnectivity-nrf52840dk']?.version,
        ble_info: {
          mac_address: (rawDevice.metadata as any)?.mac,
          rssi: (rawDevice.metadata as any)?.rssi,
          connection_interval: (rawDevice.metadata as any)?.interval
        },
        ...rawDevice.metadata as Record<string, unknown>
      }
    }
  }
  
  prepareCommand(command: Record<string, unknown>): Record<string, unknown> {
    return {
      type: command.type,
      params: command.params,
      timestamp: new Date().toISOString(),
      target: 'ble-device'
    }
  }
  
  parseTelemetry(data: Record<string, unknown>): Record<string, unknown> {
    return {
      temperature: data.temperature,
      humidity: data.humidity,
      battery_level: data.battery,
      rssi: data.rssi,
      accelerometer: data.accel,
      button_state: data.buttons
    }
  }
  
  private mapStatus(status: string): Device['status'] {
    switch (status) {
      case 'connected': return 'online'
      case 'disconnected': return 'offline'
      case '-': return 'unknown'
      default: return 'unknown'
    }
  }
}

// VMark Protocol Adapter
export class VmarkProtocolAdapter extends DeviceAdapter {
  deviceType = 'vmark_sensor'
  supportedProtocols = ['mqtt', 'https']
  
  normalizeDevice(rawDevice: Record<string, unknown>): Device {
    return {
      id: rawDevice.id as string || crypto.randomUUID(),
      name: rawDevice.name as string || `VMark-${rawDevice.device}`,
      hardware_id: rawDevice.device as string,
      status: rawDevice.status as Device['status'] || 'unknown',
      last_seen: rawDevice.time as string,
      metadata: {
        device_type: this.deviceType,
        product: rawDevice.product,
        service: rawDevice.service,
        handle_types: rawDevice.supported_handles || [],
        ...rawDevice.metadata as Record<string, unknown>
      }
    }
  }
  
  prepareCommand(command: Record<string, unknown>): Record<string, unknown> {
    // VMark command format
    return {
      device: command.device_id,
      handle: command.type || 'command',
      paras: command.params || {},
      time: new Date().toISOString().replace('T', '_').split('.')[0],
      service: 'netneural-hub'
    }
  }
  
  parseTelemetry(data: Record<string, unknown>): Record<string, unknown> {
    // Parse VMark format: { device, handle, paras, time, product, service }
    if (data.handle === 'properties_report' && data.paras) {
      return data.paras as Record<string, unknown>
    }
    
    return {
      raw_data: data,
      handle: data.handle,
      device: data.device,
      timestamp: data.time
    }
  }
}

// ===========================================================================
// Main NetNeural Hub Client
// ===========================================================================

export class NetNeuralHubClient extends BaseIntegrationClient {
  private hubConfig!: NetNeuralHubConfig
  private protocolHandlers: Map<string, ProtocolHandler> = new Map()
  private deviceAdapters: Map<string, DeviceAdapter> = new Map()
  private deviceCapabilities: Map<string, DeviceCapability[]> = new Map()
  
  constructor(config: IntegrationConfig) {
    super(config)
    this.initializeAdapters()
  }
  
  protected validateConfig(): void {
    const settings = this.config.settings as unknown as NetNeuralHubConfig
    
    if (!settings.protocols) {
      throw new IntegrationError('NetNeural Hub configuration missing protocols', 'INVALID_CONFIG')
    }
    
    // Validate at least one protocol is enabled
    const enabledProtocols = Object.entries(settings.protocols).filter(([, config]) => config?.enabled)
    if (enabledProtocols.length === 0) {
      throw new IntegrationError('NetNeural Hub must have at least one protocol enabled', 'NO_PROTOCOLS')
    }
    
    this.hubConfig = settings
    this.initializeProtocolHandlers()
  }
  
  private initializeProtocolHandlers(): void {
    if (this.hubConfig.protocols.coap?.enabled) {
      this.protocolHandlers.set('coap', new CoapProtocolHandler(this.hubConfig.protocols.coap))
    }
    
    if (this.hubConfig.protocols.mqtt?.enabled) {
      this.protocolHandlers.set('mqtt', new MqttProtocolHandler(this.hubConfig.protocols.mqtt))
    }
    
    if (this.hubConfig.protocols.https?.enabled) {
      this.protocolHandlers.set('https', new HttpsProtocolHandler(this.hubConfig.protocols.https))
    }
  }
  
  private initializeAdapters(): void {
    // Register built-in device adapters
    const adapters = [
      new Nrf9151CellularAdapter(),
      new Nrf52840BleAdapter(),
      new VmarkProtocolAdapter()
    ]
    
    for (const adapter of adapters) {
      this.deviceAdapters.set(adapter.deviceType, adapter)
    }
  }
  
  public async test(): Promise<TestResult> {
    const results: TestResult[] = []
    
    // Test all enabled protocols
    for (const [protocol, handler] of this.protocolHandlers) {
      try {
        const result = await handler.test()
        results.push({
          ...result,
          message: `${protocol.toUpperCase()}: ${result.message}`
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        results.push({
          success: false,
          message: `${protocol.toUpperCase()}: ${errorMessage}`,
          details: { error: errorMessage }
        })
      }
    }
    
    const allSuccess = results.every(r => r.success)
    
    return {
      success: allSuccess,
      message: allSuccess 
        ? 'All NetNeural Hub protocols operational'
        : `${results.filter(r => !r.success).length} protocol(s) failed`,
      details: { protocol_results: results }
    }
  }
  
  public async import(): Promise<SyncResult> {
    let totalProcessed = 0
    let totalSucceeded = 0
    let totalFailed = 0
    const errors: string[] = []
    const logs: string[] = []
    
    logs.push('[NetNeuralHub] Starting multi-protocol device import...')
    
    // Load device capabilities from database
    await this.loadDeviceCapabilities()
    
    // Import devices from each protocol
    for (const [protocol, handler] of this.protocolHandlers) {
      try {
        logs.push(`[NetNeuralHub] Importing devices from ${protocol.toUpperCase()}...`)
        
        const devices = await handler.getDevices()
        totalProcessed += devices.length
        
        for (const device of devices) {
          try {
            // Detect device type and normalize
            const normalizedDevice = await this.normalizeDevice(device as any, protocol)
            
            // Insert/update device in database
            const { error } = await this.config.supabase
              .from('devices')
              .upsert({
                id: crypto.randomUUID(), // Explicit UUID generation to avoid caching bug
                integration_id: this.config.integrationId,
                name: normalizedDevice.name,
                hardware_id: normalizedDevice.hardware_id,
                status: normalizedDevice.status,
                last_seen: normalizedDevice.last_seen,
                location: normalizedDevice.location,
                metadata: normalizedDevice.metadata,
                device_type: normalizedDevice.metadata?.device_type,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'hardware_id',
                ignoreDuplicates: false
              })
            
            if (error) {
              errors.push(`Failed to save device ${device.name}: ${error.message}`)
              totalFailed++
            } else {
              totalSucceeded++
              logs.push(`[NetNeuralHub] ✅ Imported ${normalizedDevice.name} (${normalizedDevice.metadata?.device_type})`)
            }
          } catch (deviceError) {
            const errorMsg = deviceError instanceof Error ? deviceError.message : 'Unknown error'
            errors.push(`Device processing failed for ${device.name}: ${errorMsg}`)
            totalFailed++
          }
        }
      } catch (protocolError) {
        const errorMsg = protocolError instanceof Error ? protocolError.message : 'Unknown error'
        errors.push(`${protocol} import failed: ${errorMsg}`)
        logs.push(`[NetNeuralHub] ❌ ${protocol.toUpperCase()} import failed: ${errorMsg}`)
      }
    }
    
    logs.push(`[NetNeuralHub] Import complete: ${totalSucceeded}/${totalProcessed} devices imported successfully`)
    
    return {
      devices_processed: totalProcessed,
      devices_succeeded: totalSucceeded,
      devices_failed: totalFailed,
      errors,
      logs,
      details: {
        protocols_used: Array.from(this.protocolHandlers.keys()),
        device_types_found: Array.from(this.deviceAdapters.keys())
      }
    }
  }
  
  public async export(devices: Device[]): Promise<SyncResult> {
    let totalProcessed = 0
    let totalSucceeded = 0
    let totalFailed = 0
    const errors: string[] = []
    const logs: string[] = []
    
    logs.push(`[NetNeuralHub] Starting export of ${devices.length} devices...`)
    
    for (const device of devices) {
      totalProcessed++
      
      try {
        // Determine best protocol for this device
        const protocol = this.selectProtocolForDevice(device)
        const handler = this.protocolHandlers.get(protocol)
        
        if (!handler) {
          errors.push(`No handler available for protocol ${protocol}`)
          totalFailed++
          continue
        }
        
        // Send device registration/update to external system
        const success = await handler.sendTelemetry(device.hardware_id || device.id, {
          action: 'register_device',
          device_name: device.name,
          device_type: device.metadata?.device_type,
          status: device.status,
          metadata: device.metadata
        })
        
        if (success) {
          totalSucceeded++
          logs.push(`[NetNeuralHub] ✅ Exported ${device.name} via ${protocol.toUpperCase()}`)
        } else {
          totalFailed++
          errors.push(`Failed to export ${device.name} via ${protocol}`)
        }
      } catch (error) {
        totalFailed++
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Export failed for ${device.name}: ${errorMsg}`)
        logs.push(`[NetNeuralHub] ❌ Export failed for ${device.name}: ${errorMsg}`)
      }
    }
    
    logs.push(`[NetNeuralHub] Export complete: ${totalSucceeded}/${totalProcessed} devices exported successfully`)
    
    return {
      devices_processed: totalProcessed,
      devices_succeeded: totalSucceeded,
      devices_failed: totalFailed,
      errors,
      logs,
      details: {
        protocols_used: Array.from(this.protocolHandlers.keys())
      }
    }
  }
  
  // ===========================================================================
  // Helper Methods
  // ===========================================================================
  
  private async loadDeviceCapabilities(): Promise<void> {
    try {
      const { data: capabilities, error } = await this.config.supabase
        .from('device_capabilities')
        .select('*')
      
      if (error) {
        console.warn('[NetNeuralHub] Failed to load device capabilities:', error.message)
        return
      }
      
      // Group capabilities by device type
      for (const capability of capabilities || []) {
        if (!this.deviceCapabilities.has(capability.device_type)) {
          this.deviceCapabilities.set(capability.device_type, [])
        }
        this.deviceCapabilities.get(capability.device_type)!.push(capability)
      }
    } catch (error) {
      console.warn('[NetNeuralHub] Error loading device capabilities:', error)
    }
  }
  
  private async normalizeDevice(rawDevice: Record<string, unknown>, sourceProtocol: string): Promise<Device> {
    // Detect device type from hardware ID, name, or metadata
    const deviceType = await this.detectDeviceType(rawDevice)
    
    // Use appropriate adapter if available
    const adapter = this.deviceAdapters.get(deviceType)
    if (adapter) {
      return adapter.normalizeDevice(rawDevice)
    }
    
    // Fallback to generic normalization
    return {
      id: rawDevice.id as string || crypto.randomUUID(),
      name: rawDevice.name as string || 'Unknown NetNeural Device',
      hardware_id: rawDevice.hardware_id as string || rawDevice.id as string,
      status: rawDevice.status as Device['status'] || 'unknown',
      last_seen: rawDevice.last_seen as string,
      metadata: {
        device_type: deviceType,
        source_protocol: sourceProtocol,
        original_data: rawDevice
      }
    }
  }
  
  private detectDeviceType(rawDevice: Record<string, unknown>): string {
    const hardwareId = rawDevice.hardware_id as string || ''
    const name = rawDevice.name as string || ''
    const metadata = rawDevice.metadata as Record<string, unknown> || {}
    
    // Pattern matching for known device types
    if (hardwareId.includes('c252') || hardwareId.includes('c253') || name.toLowerCase().includes('c252') || name.toLowerCase().includes('c253')) {
      return 'nrf9151_cellular'
    }
    
    if (hardwareId.includes('nrf52840') || name.toLowerCase().includes('nrf52840') || metadata.firmware?.includes?.('nrf52840')) {
      return 'nrf52840_ble'
    }
    
    if (hardwareId.includes('vmark') || name.toLowerCase().includes('vmark') || metadata.protocol === 'vmark') {
      return 'vmark_sensor'
    }
    
    // Check against capability database patterns
    for (const [deviceType, capabilities] of this.deviceCapabilities) {
      const typePatterns = capabilities
        .filter(cap => cap.capability === 'hardware_pattern')
        .map(cap => cap.metadata.pattern as string)
      
      for (const pattern of typePatterns) {
        if (hardwareId.match(pattern) || name.match(pattern)) {
          return deviceType
        }
      }
    }
    
    return 'unknown_netneural'
  }
  
  private selectProtocolForDevice(device: Device): string {
    const deviceType = device.metadata?.device_type as string
    
    // Use configured routing preferences
    const routing = this.hubConfig.device_routing[deviceType] || this.hubConfig.device_routing.default
    
    if (routing?.preferred_protocols) {
      for (const protocol of routing.preferred_protocols) {
        if (this.protocolHandlers.has(protocol)) {
          return protocol
        }
      }
    }
    
    // Fallback to first available protocol
    const protocols = Array.from(this.protocolHandlers.keys())
    return protocols.length > 0 ? protocols[0] : 'https'
  }
  
  // ===========================================================================
  // Extensibility Methods
  // ===========================================================================
  
  /**
   * Register a new device adapter for custom device types
   * Enables seamless support for future NetNeural devices
   */
  public registerDeviceAdapter(adapter: DeviceAdapter): void {
    this.deviceAdapters.set(adapter.deviceType, adapter)
    // Device adapter registered
  }
  
  /**
   * Register a new protocol handler for additional protocols
   * Enables support for new communication protocols
   */
  public registerProtocolHandler(protocol: string, handler: ProtocolHandler): void {
    this.protocolHandlers.set(protocol, handler)
    // Protocol handler registered
  }
  
  /**
   * Add device capabilities to the database
   * Enables auto-detection and routing for new device types
   */
  public async addDeviceCapabilities(deviceType: string, capabilities: Array<{capability: string, metadata: Record<string, unknown>}>): Promise<void> {
    const inserts = capabilities.map(cap => ({
      id: crypto.randomUUID(),
      device_type: deviceType,
      capability: cap.capability,
      metadata: cap.metadata
    }))
    
    const { error } = await this.config.supabase
      .from('device_capabilities')
      .insert(inserts)
    
    if (error) {
      throw new IntegrationError(`Failed to add capabilities for ${deviceType}: ${error.message}`, 'DB_ERROR')
    }
    
    // Update local cache
    this.deviceCapabilities.set(deviceType, inserts.map(insert => ({
      device_type: insert.device_type,
      capability: insert.capability,
      metadata: insert.metadata
    })))
    
    // Device capabilities added
  }
}