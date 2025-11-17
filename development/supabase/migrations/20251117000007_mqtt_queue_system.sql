-- ============================================================================
-- MQTT Queue System (Hosted Broker Replacement)
-- ============================================================================
-- Uses PostgreSQL as a message queue for MQTT-style telemetry
-- Devices POST to edge function → Messages queued → Processed asynchronously
-- No external broker needed - just Supabase database + edge functions
-- ============================================================================

-- Create message queue table
CREATE TABLE IF NOT EXISTS public.mqtt_message_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.device_integrations(id) ON DELETE CASCADE,
  
  -- Message data
  topic TEXT NOT NULL,
  payload JSONB NOT NULL,
  qos INTEGER DEFAULT 0 CHECK (qos IN (0, 1, 2)),
  
  -- Queue metadata
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  
  -- Error tracking
  error_message TEXT,
  
  -- Indexing
  CONSTRAINT valid_retry CHECK (next_retry_at IS NULL OR status = 'failed')
);

-- Indexes for queue processing
CREATE INDEX IF NOT EXISTS idx_mqtt_queue_status ON public.mqtt_message_queue(status, next_retry_at) 
  WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_mqtt_queue_org ON public.mqtt_message_queue(organization_id);
CREATE INDEX IF NOT EXISTS idx_mqtt_queue_integration ON public.mqtt_message_queue(integration_id);
CREATE INDEX IF NOT EXISTS idx_mqtt_queue_created ON public.mqtt_message_queue(created_at DESC);

-- RLS Policies
ALTER TABLE public.mqtt_message_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access"
  ON public.mqtt_message_queue FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Organization members can view their queue"
  ON public.mqtt_message_queue FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Function to enqueue a message
CREATE OR REPLACE FUNCTION enqueue_mqtt_message(
  p_organization_id UUID,
  p_integration_id UUID,
  p_topic TEXT,
  p_payload JSONB,
  p_qos INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message_id UUID;
BEGIN
  -- Insert message into queue
  INSERT INTO public.mqtt_message_queue (
    organization_id,
    integration_id,
    topic,
    payload,
    qos,
    status
  ) VALUES (
    p_organization_id,
    p_integration_id,
    p_topic,
    p_payload,
    p_qos,
    'pending'
  )
  RETURNING id INTO v_message_id;
  
  -- Notify queue processor (if using LISTEN/NOTIFY)
  PERFORM pg_notify('mqtt_queue', v_message_id::text);
  
  RETURN v_message_id;
END;
$$;

-- Function to process next message in queue
CREATE OR REPLACE FUNCTION process_mqtt_queue_message(
  p_message_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message RECORD;
  v_device_id TEXT;
BEGIN
  -- Lock and fetch message
  SELECT * INTO v_message
  FROM public.mqtt_message_queue
  WHERE id = p_message_id
    AND status IN ('pending', 'failed')
    AND (next_retry_at IS NULL OR next_retry_at <= now())
  FOR UPDATE SKIP LOCKED;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Mark as processing
  UPDATE public.mqtt_message_queue
  SET status = 'processing',
      attempts = attempts + 1
  WHERE id = p_message_id;
  
  BEGIN
    -- Store in mqtt_messages history
    INSERT INTO public.mqtt_messages (
      organization_id,
      integration_id,
      topic,
      payload,
      qos,
      direction
    ) VALUES (
      v_message.organization_id,
      v_message.integration_id,
      v_message.topic,
      v_message.payload,
      v_message.qos,
      'incoming'
    );
    
    -- Process based on topic (e.g., update device)
    -- Extract device_id from topic like: org_xxx/devices/sensor01/telemetry
    IF v_message.topic ~ '.*/devices/([^/]+)/.*' THEN
      v_device_id := (regexp_matches(v_message.topic, '.*/devices/([^/]+)/.*'))[1];
      
      -- Update device status
      UPDATE public.devices
      SET 
        last_seen_at = now(),
        last_data = v_message.payload,
        status = 'online',
        updated_at = now()
      WHERE device_id = v_device_id
        AND organization_id = v_message.organization_id;
    END IF;
    
    -- Mark as completed
    UPDATE public.mqtt_message_queue
    SET status = 'completed',
        processed_at = now()
    WHERE id = p_message_id;
    
    RETURN TRUE;
    
  EXCEPTION WHEN OTHERS THEN
    -- Mark as failed, schedule retry if attempts remain
    UPDATE public.mqtt_message_queue
    SET status = CASE 
          WHEN attempts >= max_attempts THEN 'failed'
          ELSE 'failed'
        END,
        failed_at = CASE WHEN attempts >= max_attempts THEN now() ELSE NULL END,
        next_retry_at = CASE 
          WHEN attempts < max_attempts THEN now() + (attempts * interval '30 seconds')
          ELSE NULL
        END,
        error_message = SQLERRM
    WHERE id = p_message_id;
    
    RETURN FALSE;
  END;
END;
$$;

-- Function to get queue statistics
CREATE OR REPLACE FUNCTION get_mqtt_queue_stats(
  p_organization_id UUID DEFAULT NULL
)
RETURNS TABLE (
  pending_count BIGINT,
  processing_count BIGINT,
  completed_count BIGINT,
  failed_count BIGINT,
  avg_processing_time INTERVAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
    COUNT(*) FILTER (WHERE status = 'processing') AS processing_count,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
    AVG(processed_at - created_at) FILTER (WHERE status = 'completed') AS avg_processing_time
  FROM public.mqtt_message_queue
  WHERE p_organization_id IS NULL OR organization_id = p_organization_id;
END;
$$;

-- Cleanup old processed messages (run periodically via cron)
CREATE OR REPLACE FUNCTION cleanup_mqtt_queue()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete completed messages older than 7 days
  DELETE FROM public.mqtt_message_queue
  WHERE status = 'completed'
    AND processed_at < now() - interval '7 days';
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  -- Delete failed messages older than 30 days
  DELETE FROM public.mqtt_message_queue
  WHERE status = 'failed'
    AND failed_at < now() - interval '30 days';
  
  RETURN v_deleted_count;
END;
$$;

-- Comments
COMMENT ON TABLE public.mqtt_message_queue IS 'Queue for MQTT-style messages from hosted integration';
COMMENT ON FUNCTION enqueue_mqtt_message IS 'Add message to queue for async processing';
COMMENT ON FUNCTION process_mqtt_queue_message IS 'Process a single message from queue';
COMMENT ON FUNCTION get_mqtt_queue_stats IS 'Get queue statistics for monitoring';
COMMENT ON FUNCTION cleanup_mqtt_queue IS 'Clean up old processed messages';
