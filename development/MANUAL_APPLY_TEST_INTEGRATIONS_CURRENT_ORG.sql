-- Manual Migration: Add Test Integrations to YOUR Organization
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/sql

-- STEP 1: Find your current organization ID
-- Copy the organization_id from the results
SELECT 
    o.id as organization_id,
    o.name as organization_name,
    o.slug as organization_slug
FROM organizations o
JOIN organization_members om ON o.id = om.organization_id
WHERE om.user_id = auth.uid()
ORDER BY o.created_at
LIMIT 1;

-- STEP 2: Replace 'YOUR-ORG-ID-HERE' below with the organization_id from Step 1
-- Then run this INSERT statement

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
    -- Golioth Integration
    (
        gen_random_uuid(),
        'YOUR-ORG-ID-HERE',  -- REPLACE THIS
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
        gen_random_uuid(),
        'YOUR-ORG-ID-HERE',  -- REPLACE THIS
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
        gen_random_uuid(),
        'YOUR-ORG-ID-HERE',  -- REPLACE THIS
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
    -- MQTT Broker Integration
    (
        gen_random_uuid(),
        'YOUR-ORG-ID-HERE',  -- REPLACE THIS
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
        gen_random_uuid(),
        'YOUR-ORG-ID-HERE',  -- REPLACE THIS
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
        gen_random_uuid(),
        'YOUR-ORG-ID-HERE',  -- REPLACE THIS
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
        gen_random_uuid(),
        'YOUR-ORG-ID-HERE',  -- REPLACE THIS
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
    -- NetNeural Hub Integration
    (
        gen_random_uuid(),
        'YOUR-ORG-ID-HERE',  -- REPLACE THIS
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
    );

-- STEP 3: Verify the inserts
SELECT 
    integration_type,
    name,
    status,
    organization_id,
    created_at
FROM device_integrations
WHERE organization_id = 'YOUR-ORG-ID-HERE'  -- REPLACE THIS
AND name LIKE 'Test%'
ORDER BY integration_type;
