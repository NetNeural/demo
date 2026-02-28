-- Alternative restart mechanism using database flags
-- MQTT subscriber can poll this table and restart itself when flag is set

-- Create restart requests table
CREATE TABLE IF NOT EXISTS public.service_restart_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    requested_by UUID REFERENCES auth.users(id),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    result JSONB,
    CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Index for efficient polling
CREATE INDEX IF NOT EXISTS idx_restart_pending 
    ON public.service_restart_requests(service_name, status, requested_at)
    WHERE status = 'pending';

-- RLS policies
ALTER TABLE public.service_restart_requests ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to request restarts
DROP POLICY IF EXISTS "Users can request service restarts" ON public.service_restart_requests;
CREATE POLICY "Users can request service restarts"
    ON public.service_restart_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow users to view their own requests
DROP POLICY IF EXISTS "Users can view their requests" ON public.service_restart_requests;
CREATE POLICY "Users can view their requests"
    ON public.service_restart_requests
    FOR SELECT
    TO authenticated
    USING (requested_by = auth.uid() OR auth.jwt()->>'role' = 'service_role');

-- Allow service role to update statuses (for MQTT subscriber)
DROP POLICY IF EXISTS "Service role can update requests" ON public.service_restart_requests;
CREATE POLICY "Service role can update requests"
    ON public.service_restart_requests
    FOR UPDATE
    TO service_role
    USING (true);

-- Grant permissions
GRANT SELECT, INSERT ON public.service_restart_requests TO authenticated;
GRANT ALL ON public.service_restart_requests TO service_role;

-- Function to create restart request
CREATE OR REPLACE FUNCTION request_service_restart(
    p_service_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request_id UUID;
BEGIN
    -- Check if there's already a pending request for this service
    IF EXISTS (
        SELECT 1 FROM public.service_restart_requests
        WHERE service_name = p_service_name
        AND status = 'pending'
        AND requested_at > now() - interval '5 minutes'
    ) THEN
        RAISE EXCEPTION 'A restart request is already pending for this service';
    END IF;

    -- Create new restart request
    INSERT INTO public.service_restart_requests (
        service_name,
        requested_by,
        status
    ) VALUES (
        p_service_name,
        auth.uid(),
        'pending'
    ) RETURNING id INTO v_request_id;

    RETURN v_request_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION request_service_restart(TEXT) TO authenticated;

COMMENT ON TABLE public.service_restart_requests IS 
'Service restart requests that can be polled by services when direct SSH/API access is unavailable';

COMMENT ON FUNCTION request_service_restart IS
'Creates a service restart request that will be picked up by the service monitor';
