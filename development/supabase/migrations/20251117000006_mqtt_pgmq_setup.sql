-- ============================================================================
-- MQTT Message Queue Setup using PGMQ
-- ============================================================================
-- Uses Supabase's PGMQ (Postgres Message Queue) for MQTT-style messaging
-- Devices POST messages to queue, workers process asynchronously
-- Much simpler and more reliable than MQTT broker
-- ============================================================================

-- Enable PGMQ extension (Supabase has this built-in)
CREATE EXTENSION IF NOT EXISTS pgmq CASCADE;

-- Create MQTT message queue
SELECT pgmq.create('mqtt_messages');

-- Create table to track processed messages (for auditing)
CREATE TABLE IF NOT EXISTS public.mqtt_message_archive (
  id BIGSERIAL PRIMARY KEY,
  msg_id BIGINT NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.device_integrations(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  payload JSONB NOT NULL,
  qos INTEGER DEFAULT 0,
  client_id TEXT,
  username TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Indexes for queries
  CONSTRAINT mqtt_message_archive_org_idx CHECK (true)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mqtt_archive_org ON public.mqtt_message_archive(organization_id);
CREATE INDEX IF NOT EXISTS idx_mqtt_archive_integration ON public.mqtt_message_archive(integration_id);
CREATE INDEX IF NOT EXISTS idx_mqtt_archive_topic ON public.mqtt_message_archive(topic);
CREATE INDEX IF NOT EXISTS idx_mqtt_archive_received ON public.mqtt_message_archive(received_at DESC);

-- RLS Policies
ALTER TABLE public.mqtt_message_archive ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role has full access to archive"
  ON public.mqtt_message_archive
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Organization members can view their messages
CREATE POLICY "Organization members can view archived messages"
  ON public.mqtt_message_archive
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Function to process MQTT queue messages
CREATE OR REPLACE FUNCTION process_mqtt_queue_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message RECORD;
  v_topic_parts TEXT[];
  v_device_id TEXT;
BEGIN
  -- Read messages from queue (batch of 10)
  FOR v_message IN 
    SELECT * FROM pgmq.read('mqtt_messages', 30, 10) -- 30 second visibility timeout, 10 messages
  LOOP
    BEGIN
      -- Archive the message
      INSERT INTO public.mqtt_message_archive (
        msg_id,
        organization_id,
        integration_id,
        topic,
        payload,
        qos,
        client_id,
        username,
        received_at
      ) VALUES (
        v_message.msg_id,
        (v_message.message->>'organization_id')::UUID,
        (v_message.message->>'integration_id')::UUID,
        v_message.message->>'topic',
        v_message.message->'payload',
        COALESCE((v_message.message->>'qos')::INTEGER, 0),
        v_message.message->>'client_id',
        v_message.message->>'username',
        v_message.enqueued_at
      );

      -- Process based on topic pattern
      v_topic_parts := string_to_array(v_message.message->>'topic', '/');
      
      -- If topic contains 'devices/{device_id}/telemetry' or 'data'
      IF array_position(v_topic_parts, 'devices') IS NOT NULL THEN
        v_device_id := v_topic_parts[array_position(v_topic_parts, 'devices') + 1];
        
        IF v_device_id IS NOT NULL AND (
          array_position(v_topic_parts, 'telemetry') IS NOT NULL OR
          array_position(v_topic_parts, 'data') IS NOT NULL
        ) THEN
          -- Update device with latest data
          UPDATE public.devices
          SET 
            last_seen_at = now(),
            last_data = v_message.message->'payload',
            status = 'online',
            updated_at = now()
          WHERE device_id = v_device_id
            AND organization_id = (v_message.message->>'organization_id')::UUID;
        END IF;
      END IF;

      -- Delete message from queue (mark as processed)
      PERFORM pgmq.delete('mqtt_messages', v_message.msg_id);
      
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue processing other messages
      RAISE WARNING 'Failed to process message %: %', v_message.msg_id, SQLERRM;
      -- Message will become visible again after timeout and can be retried
    END;
  END LOOP;
END;
$$;

-- Create cron job to process queue every 10 seconds
-- (Requires pg_cron extension - check if enabled in Supabase)
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove existing job if it exists
    PERFORM cron.unschedule('process-mqtt-queue');
    
    -- Schedule new job
    PERFORM cron.schedule(
      'process-mqtt-queue',
      '*/10 * * * * *', -- Every 10 seconds
      $job$SELECT process_mqtt_queue_messages()$job$
    );
  END IF;
END $cron$;

-- Comments
COMMENT ON TABLE public.mqtt_message_archive IS 'Archive of processed MQTT messages from PGMQ';
COMMENT ON FUNCTION process_mqtt_queue_messages IS 'Process messages from MQTT queue and update devices';

