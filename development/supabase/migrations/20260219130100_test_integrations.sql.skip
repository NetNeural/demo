-- Add test integrations for health check tests in Support Dashboard
-- Story #98: Support Dashboard Integrations Testing
-- This migration ensures all integration types have test configurations so health checks can run

-- Insert test integrations (using ON CONFLICT DO NOTHING to avoid duplicates)
INSERT INTO device_integrations (
    id,
    organization_id,
    integration_type,
    name,
    status,
    settings,
    base_url,
    project_id,
    created_at,
    updated_at
) VALUES
    -- Golioth Integration (already may exist in production)
    (
        '10000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000001', -- NetNeural org
        'golioth',
        'Test Golioth Integration',
        'active',
        jsonb_build_object(
            'projectId', 'test-project',
            'apiUrl', 'https://api.golioth.io',
            'testMode', true
        ),
        'https://api.golioth.io',
        'test-project',
        NOW(),
        NOW()
    ),
    -- AWS IoT Core Integration
    (
        '10000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000001', -- NetNeural org
        'aws_iot',
        'Test AWS IoT Core',
        'active',
        jsonb_build_object(
            'region', 'us-east-1',
            'endpoint', 'test.iot.us-east-1.amazonaws.com',
            'accessKeyId', 'AKIATEST',
            'testMode', true
        ),
        'https://test.iot.us-east-1.amazonaws.com',
        'aws-iot-test',
        NOW(),
        NOW()
    ),
    -- Azure IoT Hub Integration
    (
        '10000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000001', -- NetNeural org
        'azure_iot',
        'Test Azure IoT Hub',
        'active',
        jsonb_build_object(
            'connectionString', 'HostName=test.azure-devices.net;SharedAccessKeyName=iothubowner;SharedAccessKey=test',
            'hubName', 'test-hub',
            'testMode', true
        ),
        'https://test.azure-devices.net',
        'azure-test-hub',
        NOW(),
        NOW()
    ),
    -- MQTT Broker Integration (custom broker)
    (
        '10000000-0000-0000-0000-000000000004',
        '00000000-0000-0000-0000-000000000001', -- NetNeural org
        'mqtt',
        'Test MQTT Broker',
        'active',
        jsonb_build_object(
            'brokerUrl', 'mqtt://test.mosquitto.org',
            'port', 1883,
            'username', 'test',
            'useTls', false,
            'testMode', true
        ),
        'mqtt://test.mosquitto.org:1883',
        'mqtt-test',
        NOW(),
        NOW()
    ),
    -- Email/SMTP Integration
    (
        '10000000-0000-0000-0000-000000000005',
        '00000000-0000-0000-0000-000000000001', -- NetNeural org
        'email',
        'Test Email/SMTP',
        'active',
        jsonb_build_object(
            'smtpHost', 'smtp.example.com',
            'smtpPort', 587,
            'username', 'test@example.com',
            'useTls', true,
            'fromAddress', 'alerts@netneural.ai',
            'testMode', true
        ),
        'smtp://smtp.example.com:587',
        'email-test',
        NOW(),
        NOW()
    ),
    -- Slack Integration
    (
        '10000000-0000-0000-0000-000000000006',
        '00000000-0000-0000-0000-000000000001', -- NetNeural org
        'slack',
        'Test Slack Webhook',
        'active',
        jsonb_build_object(
            'webhookUrl', 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX',
            'channel', '#alerts-test',
            'username', 'NetNeural Alerts',
            'testMode', true
        ),
        'https://hooks.slack.com',
        'slack-test',
        NOW(),
        NOW()
    ),
    -- Custom Webhook Integration
    (
        '10000000-0000-0000-0000-000000000007',
        '00000000-0000-0000-0000-000000000001', -- NetNeural org
        'webhook',
        'Test Custom Webhook',
        'active',
        jsonb_build_object(
            'url', 'https://webhook.site/test-endpoint',
            'method', 'POST',
            'headers', jsonb_build_object(
                'Content-Type', 'application/json',
                'X-API-Key', 'test-key'
            ),
            'testMode', true
        ),
        'https://webhook.site',
        'webhook-test',
        NOW(),
        NOW()
    ),
    -- NetNeural Hub Integration (multi-protocol)
    (
        '10000000-0000-0000-0000-000000000008',
        '00000000-0000-0000-0000-000000000001', -- NetNeural org
        'netneural_hub',
        'Test NetNeural Hub',
        'active',
        jsonb_build_object(
            'protocols', jsonb_build_object(
                'coap', jsonb_build_object(
                    'enabled', true,
                    'port', 5683,
                    'endpoint', 'coap://test.netneural.local'
                ),
                'mqtt', jsonb_build_object(
                    'enabled', true,
                    'port', 1883,
                    'broker', 'mqtt://test.netneural.local'
                ),
                'https', jsonb_build_object(
                    'enabled', true,
                    'port', 443,
                    'endpoint', 'https://test.netneural.local'
                )
            ),
            'device_routing', jsonb_build_object(
                'default_protocol', 'https',
                'routing_rules', jsonb_build_array(
                    jsonb_build_object('device_type', 'sensor', 'protocol', 'coap'),
                    jsonb_build_object('device_type', 'gateway', 'protocol', 'mqtt')
                )
            ),
            'global_settings', jsonb_build_object(
                'timeout_ms', 5000,
                'retry_attempts', 3
            ),
            'testMode', true
        ),
        'https://test.netneural.local',
        'netneural-hub-test',
        NOW(),
        NOW()
    )
ON CONFLICT (id) DO NOTHING;

-- Log the migration for audit purposes
DO $$
DECLARE
    inserted_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO inserted_count
    FROM device_integrations
    WHERE id IN (
        '10000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000002',
        '10000000-0000-0000-0000-000000000003',
        '10000000-0000-0000-0000-000000000004',
        '10000000-0000-0000-0000-000000000005',
        '10000000-0000-0000-0000-000000000006',
        '10000000-0000-0000-0000-000000000007',
        '10000000-0000-0000-0000-000000000008'
    );
    
    RAISE NOTICE 'Test integrations migration complete. % test integrations available.', inserted_count;
END $$;
