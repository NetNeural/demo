-- ============================================================================
-- Migration: Data Retention Policies by Tier (#319)
-- Date: 2026-02-28
-- Purpose:
--   1. Update starter plan retention from 30 → 90 days
--   2. Create a purge function that enforces tier-based retention
--   3. Schedule a daily pg_cron job to run the purge
-- ============================================================================

-- ── Step 1: Update starter retention to 90 days ──────────────────────
UPDATE billing_plans
SET telemetry_retention_days = 90, updated_at = now()
WHERE slug = 'starter' AND is_active = true;

-- ── Step 2: Create the retention purge function ──────────────────────
-- Joins device_telemetry_history → devices → organizations → billing_plans
-- to determine per-org retention. Processes in batches to avoid lock contention.
-- Enterprise / unlimited (-1) orgs are never purged.
-- Logs each purge run to user_audit_log.

CREATE OR REPLACE FUNCTION public.purge_expired_telemetry(
  p_batch_size INTEGER DEFAULT 10000,
  p_dry_run   BOOLEAN DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org        RECORD;
  v_deleted    BIGINT := 0;
  v_org_count  INTEGER := 0;
  v_batch_del  BIGINT;
  v_cutoff     TIMESTAMPTZ;
  v_results    jsonb := '[]'::jsonb;
BEGIN
  -- Iterate over each org that has a finite retention policy
  FOR v_org IN
    SELECT
      o.id          AS org_id,
      o.name        AS org_name,
      o.subscription_tier,
      bp.telemetry_retention_days
    FROM organizations o
    JOIN billing_plans bp
      ON bp.slug = o.subscription_tier
     AND bp.is_active = true
    WHERE bp.telemetry_retention_days > 0  -- skip unlimited (-1) and zero
  LOOP
    v_cutoff := now() - (v_org.telemetry_retention_days || ' days')::interval;

    IF p_dry_run THEN
      -- Count how many rows would be deleted
      SELECT COUNT(*) INTO v_batch_del
        FROM device_telemetry_history
       WHERE organization_id = v_org.org_id
         AND received_at < v_cutoff;
    ELSE
      -- Delete in batch (limit to p_batch_size per org per run)
      WITH deleted AS (
        DELETE FROM device_telemetry_history
        WHERE id IN (
          SELECT id
            FROM device_telemetry_history
           WHERE organization_id = v_org.org_id
             AND received_at < v_cutoff
           LIMIT p_batch_size
        )
        RETURNING id
      )
      SELECT COUNT(*) INTO v_batch_del FROM deleted;
    END IF;

    IF v_batch_del > 0 THEN
      v_deleted := v_deleted + v_batch_del;
      v_org_count := v_org_count + 1;

      v_results := v_results || jsonb_build_object(
        'org_id',        v_org.org_id,
        'org_name',      v_org.org_name,
        'tier',          v_org.subscription_tier,
        'retention_days', v_org.telemetry_retention_days,
        'cutoff',        v_cutoff,
        'rows_affected', v_batch_del,
        'dry_run',       p_dry_run
      );

      -- Audit log entry (skip for dry runs)
      IF NOT p_dry_run THEN
        INSERT INTO user_audit_log (
          user_id, action, resource_type, resource_id, details
        ) VALUES (
          '00000000-0000-0000-0000-000000000000',  -- system user
          'telemetry_purge',
          'organization',
          v_org.org_id::text,
          jsonb_build_object(
            'rows_deleted',    v_batch_del,
            'retention_days',  v_org.telemetry_retention_days,
            'cutoff_date',     v_cutoff,
            'tier',            v_org.subscription_tier
          )
        );
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'total_rows_affected', v_deleted,
    'orgs_processed',      v_org_count,
    'dry_run',             p_dry_run,
    'run_at',              now(),
    'details',             v_results
  );
END;
$$;

COMMENT ON FUNCTION public.purge_expired_telemetry IS
  'Daily retention enforcement: deletes telemetry older than the org tier allows. '
  'Starter=90d, Professional=365d, Enterprise=unlimited. Batch-limited to avoid lock contention.';

-- ── Step 3: Schedule daily cron job (2:00 AM UTC) ────────────────────
-- pg_cron is already enabled from earlier migrations.
SELECT cron.schedule(
  'telemetry-retention-purge',
  '0 2 * * *',                         -- daily at 02:00 UTC
  $$SELECT public.purge_expired_telemetry(10000, false)$$
);

-- ── Verify ───────────────────────────────────────────────────────────
DO $$
DECLARE
  v_ret INTEGER;
BEGIN
  SELECT telemetry_retention_days INTO v_ret
    FROM billing_plans WHERE slug = 'starter' AND is_active = true;
  IF v_ret IS DISTINCT FROM 90 THEN
    RAISE EXCEPTION 'Expected starter retention = 90, got %', v_ret;
  END IF;

  RAISE NOTICE 'Retention policy migration complete. Starter=90d, cron scheduled.';
END $$;
