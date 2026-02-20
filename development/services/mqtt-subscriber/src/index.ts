/**
 * NetNeural MQTT Subscriber Service
 * ==================================
 * Persistent MQTT client that subscribes to configured topics and forwards
 * messages to Supabase for processing.
 * 
 * Features:
 * - Connects to multiple MQTT integrations simultaneously
 * - Auto-reconnects on connection loss
 * - Processes and stores telemetry data
 * - Logs all activity to integration_activity_log
 * - Graceful shutdown handling
 */

import mqtt, { MqttClient } from 'mqtt';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import pino from 'pino';
import { config } from './config';
import { MqttIntegration, ProcessedMessage } from './types';
import { MessageProcessor } from './message-processor';

const logger = pino({
  level: config.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
});

class MqttSubscriberService {
  private supabase: SupabaseClient;
  private clients: Map<string, MqttClient> = new Map();
  private messageProcessor: MessageProcessor;
  private isShuttingDown = false;
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  
  constructor() {
    this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    this.messageProcessor = new MessageProcessor(this.supabase, logger);
    
    // Handle graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  async start(): Promise<void> {
    logger.info('🚀 Starting MQTT Subscriber Service...');
    
    try {
      // Load active MQTT integrations from database
      const integrations = await this.loadIntegrations();
      
      if (integrations.length === 0) {
        logger.warn('⚠️  No active MQTT integrations found. Service will check again in 60 seconds.');
        setTimeout(() => this.start(), 60000);
        return;
      }
      
      logger.info(`Found ${integrations.length} MQTT integration(s) to monitor`);
      
      // Connect to each integration
      for (const integration of integrations) {
        await this.connectToIntegration(integration);
      }
      
      // Refresh integrations every 5 minutes
      setInterval(() => this.refreshIntegrations(), 5 * 60 * 1000);
      
      logger.info('✅ MQTT Subscriber Service is running');
    } catch (error) {
      logger.error({ error }, 'Failed to start service');
      process.exit(1);
    }
  }

  private async loadIntegrations(): Promise<MqttIntegration[]> {
    const { data, error } = await this.supabase
      .from('device_integrations')
      .select('*')
      .in('integration_type', ['mqtt', 'mqtt_external', 'mqtt_hosted'])
      .eq('status', 'active');

    if (error) {
      logger.error({ error }, 'Failed to load integrations');
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      organizationId: row.organization_id,
      integrationType: row.integration_type,
      settings: row.settings || {},
      status: row.status,
    }));
  }

  private async connectToIntegration(integration: MqttIntegration): Promise<void> {
    const { id, name, settings } = integration;
    
    // Check if already connected
    if (this.clients.has(id)) {
      logger.debug(`Already connected to ${name} (${id})`);
      return;
    }

    try {
      const brokerUrl = settings.brokerUrl || settings.broker_url;
      const port = settings.port || 1883;
      const username = settings.username;
      const password = settings.password;
      const clientId = settings.clientId || `netneural-subscriber-${id}-${Date.now()}`;
      const topics = this.parseTopics(settings.topics);

      if (!brokerUrl) {
        logger.warn(`No broker URL configured for ${name} (${id})`);
        return;
      }

      logger.info(`Connecting to ${name} at ${brokerUrl}:${port}...`);

      const client = mqtt.connect(brokerUrl, {
        port,
        clientId,
        username,
        password,
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 30000,
      });

      // Connection established
      client.on('connect', () => {
        logger.info(`✅ Connected to ${name} (${id})`);
        
        // Subscribe to topics
        if (topics.length > 0) {
          client.subscribe(topics, (err) => {
            if (err) {
              logger.error({ err, topics }, `Failed to subscribe to topics for ${name}`);
            } else {
              logger.info({ topics }, `📡 Subscribed to ${topics.length} topic(s) for ${name}`);
            }
          });
        } else {
          logger.warn(`No topics configured for ${name} (${id})`);
        }
      });

      // Handle incoming messages
      client.on('message', async (topic, message) => {
        try {
          await this.handleMessage(integration, topic, message);
        } catch (error) {
          logger.error({ error, topic, integrationId: id }, 'Failed to process message');
        }
      });

      // Handle errors
      client.on('error', (error) => {
        logger.error({ error, integrationId: id, name }, 'MQTT client error');
      });

      // Handle disconnection
      client.on('close', () => {
        logger.warn(`Disconnected from ${name} (${id})`);
        this.clients.delete(id);
        
        // Schedule reconnection if not shutting down
        if (!this.isShuttingDown) {
          const timer = setTimeout(() => {
            logger.info(`Attempting to reconnect to ${name}...`);
            this.connectToIntegration(integration);
          }, 10000);
          this.reconnectTimers.set(id, timer);
        }
      });

      // Store client reference
      this.clients.set(id, client);
      
    } catch (error) {
      logger.error({ error, integrationId: id, name }, 'Failed to connect to integration');
    }
  }

  private parseTopics(topicsConfig: any): string[] {
    if (Array.isArray(topicsConfig)) {
      return topicsConfig;
    }
    if (typeof topicsConfig === 'string') {
      return topicsConfig.split(',').map(t => t.trim()).filter(Boolean);
    }
    // Default topics if none configured
    return [
      'devices/+/telemetry',
      'devices/+/status',
      'netneural/+/data',
    ];
  }

  private async handleMessage(
    integration: MqttIntegration,
    topic: string,
    message: Buffer
  ): Promise<void> {
    const messageStr = message.toString();
    
    logger.debug({
      integration: integration.name,
      topic,
      messageSize: message.length,
    }, 'Received message');

    try {
      // Process the message
      const processed = await this.messageProcessor.process(
        integration,
        topic,
        messageStr
      );

      if (processed) {
        logger.info({
          deviceId: processed.deviceId,
          topic,
          integration: integration.name,
        }, 'Message processed successfully');
      }
    } catch (error) {
      logger.error({ error, topic, integration: integration.name }, 'Message processing failed');
    }
  }

  private async refreshIntegrations(): Promise<void> {
    logger.info('Refreshing integrations...');
    
    const integrations = await this.loadIntegrations();
    const currentIds = new Set(this.clients.keys());
    const newIds = new Set(integrations.map(i => i.id));

    // Disconnect from removed integrations
    for (const id of currentIds) {
      if (!newIds.has(id)) {
        logger.info(`Disconnecting from removed integration ${id}`);
        const client = this.clients.get(id);
        if (client) {
          client.end(true);
          this.clients.delete(id);
        }
      }
    }

    // Connect to new integrations
    for (const integration of integrations) {
      if (!currentIds.has(integration.id)) {
        logger.info(`Connecting to new integration ${integration.name}`);
        await this.connectToIntegration(integration);
      }
    }
  }

  private async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    logger.info('🛑 Shutting down gracefully...');

    // Clear reconnect timers
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();

    // Disconnect all clients
    const disconnectPromises = Array.from(this.clients.entries()).map(
      ([id, client]) =>
        new Promise<void>((resolve) => {
          logger.info(`Disconnecting from ${id}...`);
          client.end(false, {}, () => {
            logger.info(`Disconnected from ${id}`);
            resolve();
          });
        })
    );

    await Promise.all(disconnectPromises);
    
    logger.info('✅ Shutdown complete');
    process.exit(0);
  }
}

// Start the service
const service = new MqttSubscriberService();
service.start().catch((error) => {
  logger.error({ error }, 'Fatal error');
  process.exit(1);
});
