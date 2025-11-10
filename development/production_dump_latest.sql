

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."alert_severity" AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);


ALTER TYPE "public"."alert_severity" OWNER TO "postgres";


CREATE TYPE "public"."device_status" AS ENUM (
    'online',
    'offline',
    'warning',
    'error'
);


ALTER TYPE "public"."device_status" OWNER TO "postgres";


CREATE TYPE "public"."notification_method" AS ENUM (
    'email',
    'sms',
    'webhook',
    'in_app'
);


ALTER TYPE "public"."notification_method" OWNER TO "postgres";


CREATE TYPE "public"."notification_status" AS ENUM (
    'pending',
    'sent',
    'delivered',
    'failed'
);


ALTER TYPE "public"."notification_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'super_admin',
    'org_admin',
    'org_owner',
    'user',
    'viewer'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_generate_webhook_config"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  needs_webhook BOOLEAN;
BEGIN
  -- Check if integration type supports webhooks
  needs_webhook := NEW.integration_type IN ('golioth', 'aws_iot', 'aws-iot', 'azure_iot', 'azure-iot', 'google_iot', 'google-iot', 'mqtt');
  
  IF needs_webhook THEN
    -- Generate webhook URL if not set
    IF NEW.webhook_url IS NULL OR NEW.webhook_url = '' THEN
      NEW.webhook_url := generate_webhook_url(NEW.id, NEW.integration_type);
    END IF;
    
    -- Generate webhook secret if not set
    IF NEW.webhook_secret IS NULL OR NEW.webhook_secret = '' THEN
      NEW.webhook_secret := generate_webhook_secret();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_generate_webhook_config"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."auto_generate_webhook_config"() IS 'Trigger function that auto-populates webhook_url and webhook_secret for IoT integrations';



CREATE OR REPLACE FUNCTION "public"."cleanup_old_integration_logs"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM integration_activity_log
    WHERE created_at < NOW() - INTERVAL '90 days'
    RETURNING COUNT(*) INTO deleted_count;
    
    RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_integration_logs"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_old_integration_logs"() IS 'Removes activity logs older than 90 days for storage optimization';



CREATE OR REPLACE FUNCTION "public"."complete_integration_activity"("p_log_id" "uuid", "p_status" character varying, "p_response_status" integer DEFAULT NULL::integer, "p_response_body" "jsonb" DEFAULT NULL::"jsonb", "p_response_time_ms" integer DEFAULT NULL::integer, "p_error_message" "text" DEFAULT NULL::"text", "p_error_code" character varying DEFAULT NULL::character varying) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE integration_activity_log
    SET 
        status = p_status,
        response_status = p_response_status,
        response_body = p_response_body,
        response_time_ms = p_response_time_ms,
        error_message = p_error_message,
        error_code = p_error_code,
        completed_at = NOW()
    WHERE id = p_log_id;
END;
$$;


ALTER FUNCTION "public"."complete_integration_activity"("p_log_id" "uuid", "p_status" character varying, "p_response_status" integer, "p_response_body" "jsonb", "p_response_time_ms" integer, "p_error_message" "text", "p_error_code" character varying) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."complete_integration_activity"("p_log_id" "uuid", "p_status" character varying, "p_response_status" integer, "p_response_body" "jsonb", "p_response_time_ms" integer, "p_error_message" "text", "p_error_code" character varying) IS 'Helper function to update activity log with completion details';



CREATE OR REPLACE FUNCTION "public"."generate_webhook_secret"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Use gen_random_uuid() which is always available in Postgres
  RETURN replace(gen_random_uuid()::TEXT, '-', '') || replace(gen_random_uuid()::TEXT, '-', '');
END;
$$;


ALTER FUNCTION "public"."generate_webhook_secret"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_webhook_secret"() IS 'Generates a secure random webhook secret using crypto-secure random bytes';



CREATE OR REPLACE FUNCTION "public"."generate_webhook_url"("integration_id" "uuid", "integration_type" "text", "supabase_url" "text" DEFAULT "current_setting"('app.settings.supabase_url'::"text", true)) RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  base_url TEXT;
  webhook_endpoint TEXT;
BEGIN
  -- Get Supabase URL from settings or use default
  base_url := COALESCE(supabase_url, 'http://localhost:54321');
  
  -- Determine webhook endpoint based on integration type
  webhook_endpoint := CASE integration_type
    WHEN 'golioth' THEN 'golioth-webhook'
    WHEN 'aws_iot' THEN 'aws-iot-webhook'
    WHEN 'aws-iot' THEN 'aws-iot-webhook'
    WHEN 'azure_iot' THEN 'azure-iot-webhook'
    WHEN 'azure-iot' THEN 'azure-iot-webhook'
    WHEN 'google_iot' THEN 'google-iot-webhook'
    WHEN 'google-iot' THEN 'google-iot-webhook'
    WHEN 'mqtt' THEN 'mqtt-webhook'
    ELSE NULL
  END;
  
  -- Return NULL if integration type doesn't support webhooks
  IF webhook_endpoint IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Construct full webhook URL
  RETURN base_url || '/functions/v1/' || webhook_endpoint || '?integration_id=' || integration_id::TEXT;
END;
$$;


ALTER FUNCTION "public"."generate_webhook_url"("integration_id" "uuid", "integration_type" "text", "supabase_url" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_webhook_url"("integration_id" "uuid", "integration_type" "text", "supabase_url" "text") IS 'Generates webhook URL for IoT platform integrations based on integration ID and type';



CREATE OR REPLACE FUNCTION "public"."get_pending_conflicts"("org_id" "uuid") RETURNS TABLE("conflict_id" "uuid", "device_id" "uuid", "device_name" character varying, "conflict_type" character varying, "field_name" character varying, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dc.id,
        dc.device_id,
        d.name,
        dc.conflict_type,
        dc.field_name,
        dc.created_at
    FROM device_conflicts dc
    INNER JOIN devices d ON dc.device_id = d.id
    WHERE d.organization_id = org_id
    AND dc.resolution_status = 'pending'
    ORDER BY dc.created_at ASC;
END;
$$;


ALTER FUNCTION "public"."get_pending_conflicts"("org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_sync_stats"("org_id" "uuid", "integration_id_param" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("total_syncs" bigint, "successful_syncs" bigint, "failed_syncs" bigint, "pending_conflicts" bigint, "last_sync_at" timestamp with time zone, "avg_duration_ms" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_syncs,
        COUNT(*) FILTER (WHERE status = 'completed')::BIGINT as successful_syncs,
        COUNT(*) FILTER (WHERE status = 'failed')::BIGINT as failed_syncs,
        (SELECT COUNT(*)::BIGINT FROM device_conflicts dc 
         INNER JOIN devices d ON dc.device_id = d.id 
         WHERE d.organization_id = org_id 
         AND dc.resolution_status = 'pending') as pending_conflicts,
        MAX(completed_at) as last_sync_at,
        AVG(duration_ms)::NUMERIC as avg_duration_ms
    FROM golioth_sync_log
    WHERE organization_id = org_id
    AND (integration_id_param IS NULL OR integration_id = integration_id_param)
    AND created_at > NOW() - INTERVAL '30 days';
END;
$$;


ALTER FUNCTION "public"."get_sync_stats"("org_id" "uuid", "integration_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  default_org_id UUID;
BEGIN
  -- Get the default organization (first one, or you can specify a specific one)
  -- For now, we'll leave organization_id as NULL and let it be set later
  -- Super admins will have NULL organization_id
  
  -- Insert the new user into public.users
  INSERT INTO public.users (
    id,
    email,
    role,
    organization_id,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    'viewer',  -- Default role is viewer, can be upgraded by admin
    NULL,      -- No organization assigned by default
    NOW(),
    NOW()
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_new_user"() IS 'Automatically creates a public.users record when a new user signs up via auth.users. Default role is viewer with no organization assigned.';



CREATE OR REPLACE FUNCTION "public"."log_integration_activity"("p_organization_id" "uuid", "p_integration_id" "uuid", "p_direction" character varying, "p_activity_type" character varying, "p_method" character varying DEFAULT NULL::character varying, "p_endpoint" "text" DEFAULT NULL::"text", "p_status" character varying DEFAULT 'started'::character varying, "p_user_id" "uuid" DEFAULT NULL::"uuid", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO integration_activity_log (
        organization_id,
        integration_id,
        direction,
        activity_type,
        method,
        endpoint,
        status,
        user_id,
        metadata
    ) VALUES (
        p_organization_id,
        p_integration_id,
        p_direction,
        p_activity_type,
        p_method,
        p_endpoint,
        p_status,
        p_user_id,
        p_metadata
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$;


ALTER FUNCTION "public"."log_integration_activity"("p_organization_id" "uuid", "p_integration_id" "uuid", "p_direction" character varying, "p_activity_type" character varying, "p_method" character varying, "p_endpoint" "text", "p_status" character varying, "p_user_id" "uuid", "p_metadata" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_integration_activity"("p_organization_id" "uuid", "p_integration_id" "uuid", "p_direction" character varying, "p_activity_type" character varying, "p_method" character varying, "p_endpoint" "text", "p_status" character varying, "p_user_id" "uuid", "p_metadata" "jsonb") IS 'Helper function to create a new activity log entry';



CREATE OR REPLACE FUNCTION "public"."update_device_integrations_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_device_integrations_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_updated_at_column"() IS 'Automatically updates the updated_at column to the current timestamp when a row is modified';



CREATE OR REPLACE FUNCTION "public"."uuid_generate_v4"() RETURNS "uuid"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT gen_random_uuid();
$$;


ALTER FUNCTION "public"."uuid_generate_v4"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."alerts" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "device_id" "uuid",
    "alert_type" character varying(100) NOT NULL,
    "severity" "public"."alert_severity" NOT NULL,
    "title" character varying(255) NOT NULL,
    "message" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "is_resolved" boolean DEFAULT false,
    "resolved_by" "uuid",
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid",
    "user_id" "uuid",
    "action" character varying(100) NOT NULL,
    "resource_type" character varying(100) NOT NULL,
    "resource_id" "uuid",
    "old_values" "jsonb",
    "new_values" "jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."departments" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v4"() NOT NULL,
    "location_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "floor_level" integer,
    "area_square_feet" numeric(10,2),
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."departments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."device_conflicts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "device_id" "uuid" NOT NULL,
    "sync_log_id" "uuid",
    "conflict_type" character varying(100) NOT NULL,
    "field_name" character varying(100) NOT NULL,
    "local_value" "jsonb" NOT NULL,
    "remote_value" "jsonb" NOT NULL,
    "local_updated_at" timestamp with time zone,
    "remote_updated_at" timestamp with time zone,
    "resolution_status" character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    "resolution_strategy" character varying(50),
    "resolved_value" "jsonb",
    "resolved_by" "uuid",
    "resolved_at" timestamp with time zone,
    "auto_resolve_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "device_conflicts_resolution_status_check" CHECK ((("resolution_status")::"text" = ANY ((ARRAY['pending'::character varying, 'resolved'::character varying, 'ignored'::character varying, 'auto_resolved'::character varying])::"text"[]))),
    CONSTRAINT "device_conflicts_resolution_strategy_check" CHECK ((("resolution_strategy")::"text" = ANY ((ARRAY['local_wins'::character varying, 'remote_wins'::character varying, 'merge'::character varying, 'manual'::character varying])::"text"[]))),
    CONSTRAINT "valid_resolution" CHECK ((((("resolution_status")::"text" = 'pending'::"text") AND ("resolved_at" IS NULL)) OR ((("resolution_status")::"text" <> 'pending'::"text") AND ("resolved_at" IS NOT NULL))))
);


ALTER TABLE "public"."device_conflicts" OWNER TO "postgres";


COMMENT ON TABLE "public"."device_conflicts" IS 'Stores conflicts detected during bidirectional sync with resolution workflow.';



COMMENT ON COLUMN "public"."device_conflicts"."resolution_strategy" IS 'How conflict was resolved: local_wins, remote_wins, merge, manual';



CREATE TABLE IF NOT EXISTS "public"."device_data" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v4"() NOT NULL,
    "device_id" "uuid" NOT NULL,
    "sensor_type" character varying(100) NOT NULL,
    "value" numeric(15,6) NOT NULL,
    "unit" character varying(20),
    "quality" integer,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "device_data_quality_check" CHECK ((("quality" >= 0) AND ("quality" <= 100)))
);


ALTER TABLE "public"."device_data" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."device_integrations" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "integration_type" character varying(50) NOT NULL,
    "name" character varying(255) NOT NULL,
    "api_key_encrypted" "text",
    "project_id" character varying(255),
    "base_url" character varying(500),
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "status" character varying(50) DEFAULT 'active'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "sync_enabled" boolean DEFAULT false,
    "sync_interval_seconds" integer DEFAULT 300,
    "sync_direction" character varying(50) DEFAULT 'bidirectional'::character varying,
    "conflict_resolution" character varying(50) DEFAULT 'manual'::character varying,
    "webhook_enabled" boolean DEFAULT false,
    "webhook_secret" character varying(255),
    "webhook_url" character varying(500),
    "last_sync_at" timestamp with time zone,
    "last_sync_status" character varying(50),
    "sync_error" "text",
    CONSTRAINT "device_integrations_conflict_resolution_check" CHECK ((("conflict_resolution")::"text" = ANY ((ARRAY['local_wins'::character varying, 'remote_wins'::character varying, 'manual'::character varying, 'newest_wins'::character varying])::"text"[]))),
    CONSTRAINT "device_integrations_integration_type_check" CHECK ((("integration_type")::"text" = ANY (ARRAY[('golioth'::character varying)::"text", ('aws_iot'::character varying)::"text", ('azure_iot'::character varying)::"text", ('google_iot'::character varying)::"text", ('mqtt'::character varying)::"text", ('smtp'::character varying)::"text", ('slack'::character varying)::"text", ('webhook'::character varying)::"text"]))),
    CONSTRAINT "device_integrations_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'error'::character varying])::"text"[]))),
    CONSTRAINT "device_integrations_sync_direction_check" CHECK ((("sync_direction")::"text" = ANY ((ARRAY['import'::character varying, 'export'::character varying, 'bidirectional'::character varying, 'none'::character varying])::"text"[]))),
    CONSTRAINT "device_integrations_sync_interval_seconds_check" CHECK (("sync_interval_seconds" >= 60))
);


ALTER TABLE "public"."device_integrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."device_service_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "device_id" "uuid" NOT NULL,
    "integration_id" "uuid" NOT NULL,
    "external_device_id" character varying(255) NOT NULL,
    "sync_enabled" boolean DEFAULT true NOT NULL,
    "sync_direction" character varying(50) DEFAULT 'bidirectional'::character varying NOT NULL,
    "sync_status" character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    "last_sync_at" timestamp with time zone,
    "last_sync_log_id" "uuid",
    "sync_error" "text",
    "sync_retry_count" integer DEFAULT 0,
    "next_retry_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "device_service_assignments_sync_direction_check" CHECK ((("sync_direction")::"text" = ANY ((ARRAY['import'::character varying, 'export'::character varying, 'bidirectional'::character varying, 'none'::character varying])::"text"[]))),
    CONSTRAINT "device_service_assignments_sync_status_check" CHECK ((("sync_status")::"text" = ANY ((ARRAY['pending'::character varying, 'syncing'::character varying, 'synced'::character varying, 'error'::character varying, 'conflict'::character varying])::"text"[])))
);


ALTER TABLE "public"."device_service_assignments" OWNER TO "postgres";


COMMENT ON TABLE "public"."device_service_assignments" IS 'Maps devices to external IoT services with sync configuration.';



COMMENT ON COLUMN "public"."device_service_assignments"."sync_direction" IS 'Sync direction: import, export, bidirectional, none';



CREATE TABLE IF NOT EXISTS "public"."devices" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "integration_id" "uuid",
    "external_device_id" character varying(255),
    "name" character varying(255) NOT NULL,
    "device_type" character varying(100) NOT NULL,
    "model" character varying(100),
    "serial_number" character varying(100),
    "status" "public"."device_status" DEFAULT 'offline'::"public"."device_status",
    "last_seen" timestamp with time zone,
    "battery_level" integer,
    "signal_strength" integer,
    "firmware_version" character varying(50),
    "location_id" "uuid",
    "department_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    CONSTRAINT "devices_battery_level_check" CHECK ((("battery_level" >= 0) AND ("battery_level" <= 100))),
    CONSTRAINT "devices_signal_strength_check" CHECK ((("signal_strength" >= '-150'::integer) AND ("signal_strength" <= 0)))
);


ALTER TABLE "public"."devices" OWNER TO "postgres";


COMMENT ON COLUMN "public"."devices"."deleted_at" IS 'Timestamp when the device was soft-deleted. NULL means the device is active.';



CREATE TABLE IF NOT EXISTS "public"."golioth_sync_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "integration_id" "uuid" NOT NULL,
    "operation" character varying(100) NOT NULL,
    "status" character varying(50) NOT NULL,
    "device_id" "uuid",
    "devices_processed" integer DEFAULT 0,
    "devices_succeeded" integer DEFAULT 0,
    "devices_failed" integer DEFAULT 0,
    "conflicts_detected" integer DEFAULT 0,
    "error_message" "text",
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "duration_ms" integer,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "golioth_sync_log_operation_check" CHECK ((("operation")::"text" = ANY ((ARRAY['import'::character varying, 'export'::character varying, 'bidirectional'::character varying, 'webhook'::character varying])::"text"[]))),
    CONSTRAINT "golioth_sync_log_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['started'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying, 'partial'::character varying])::"text"[])))
)
PARTITION BY RANGE ("created_at");


ALTER TABLE "public"."golioth_sync_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."golioth_sync_log" IS 'Audit trail for all synchronization operations with Golioth. Partitioned by month for performance.';



COMMENT ON COLUMN "public"."golioth_sync_log"."operation" IS 'Type of sync: import (Golioth→Local), export (Local→Golioth), bidirectional, webhook';



COMMENT ON COLUMN "public"."golioth_sync_log"."status" IS 'Sync status: started, processing, completed, failed, partial (completed with conflicts/errors)';



CREATE TABLE IF NOT EXISTS "public"."golioth_sync_log_2025_10" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "integration_id" "uuid" NOT NULL,
    "operation" character varying(100) NOT NULL,
    "status" character varying(50) NOT NULL,
    "device_id" "uuid",
    "devices_processed" integer DEFAULT 0,
    "devices_succeeded" integer DEFAULT 0,
    "devices_failed" integer DEFAULT 0,
    "conflicts_detected" integer DEFAULT 0,
    "error_message" "text",
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "duration_ms" integer,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "golioth_sync_log_operation_check" CHECK ((("operation")::"text" = ANY ((ARRAY['import'::character varying, 'export'::character varying, 'bidirectional'::character varying, 'webhook'::character varying])::"text"[]))),
    CONSTRAINT "golioth_sync_log_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['started'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying, 'partial'::character varying])::"text"[])))
);


ALTER TABLE "public"."golioth_sync_log_2025_10" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."golioth_sync_log_2025_11" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "integration_id" "uuid" NOT NULL,
    "operation" character varying(100) NOT NULL,
    "status" character varying(50) NOT NULL,
    "device_id" "uuid",
    "devices_processed" integer DEFAULT 0,
    "devices_succeeded" integer DEFAULT 0,
    "devices_failed" integer DEFAULT 0,
    "conflicts_detected" integer DEFAULT 0,
    "error_message" "text",
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "duration_ms" integer,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "golioth_sync_log_operation_check" CHECK ((("operation")::"text" = ANY ((ARRAY['import'::character varying, 'export'::character varying, 'bidirectional'::character varying, 'webhook'::character varying])::"text"[]))),
    CONSTRAINT "golioth_sync_log_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['started'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying, 'partial'::character varying])::"text"[])))
);


ALTER TABLE "public"."golioth_sync_log_2025_11" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."golioth_sync_log_2025_12" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "integration_id" "uuid" NOT NULL,
    "operation" character varying(100) NOT NULL,
    "status" character varying(50) NOT NULL,
    "device_id" "uuid",
    "devices_processed" integer DEFAULT 0,
    "devices_succeeded" integer DEFAULT 0,
    "devices_failed" integer DEFAULT 0,
    "conflicts_detected" integer DEFAULT 0,
    "error_message" "text",
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "duration_ms" integer,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "golioth_sync_log_operation_check" CHECK ((("operation")::"text" = ANY ((ARRAY['import'::character varying, 'export'::character varying, 'bidirectional'::character varying, 'webhook'::character varying])::"text"[]))),
    CONSTRAINT "golioth_sync_log_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['started'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying, 'partial'::character varying])::"text"[])))
);


ALTER TABLE "public"."golioth_sync_log_2025_12" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."golioth_sync_log_2026_01" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "integration_id" "uuid" NOT NULL,
    "operation" character varying(100) NOT NULL,
    "status" character varying(50) NOT NULL,
    "device_id" "uuid",
    "devices_processed" integer DEFAULT 0,
    "devices_succeeded" integer DEFAULT 0,
    "devices_failed" integer DEFAULT 0,
    "conflicts_detected" integer DEFAULT 0,
    "error_message" "text",
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "duration_ms" integer,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "golioth_sync_log_operation_check" CHECK ((("operation")::"text" = ANY ((ARRAY['import'::character varying, 'export'::character varying, 'bidirectional'::character varying, 'webhook'::character varying])::"text"[]))),
    CONSTRAINT "golioth_sync_log_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['started'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying, 'partial'::character varying])::"text"[])))
);


ALTER TABLE "public"."golioth_sync_log_2026_01" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "integration_id" "uuid" NOT NULL,
    "direction" character varying(20) NOT NULL,
    "activity_type" character varying(50) NOT NULL,
    "method" character varying(10),
    "endpoint" "text",
    "request_headers" "jsonb" DEFAULT '{}'::"jsonb",
    "request_body" "jsonb",
    "response_status" integer,
    "response_body" "jsonb",
    "response_time_ms" integer,
    "status" character varying(50) NOT NULL,
    "error_message" "text",
    "error_code" character varying(50),
    "user_id" "uuid",
    "ip_address" "text",
    "user_agent" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "integration_activity_log_activity_type_check" CHECK ((("activity_type")::"text" = ANY ((ARRAY['test_connection'::character varying, 'sync_import'::character varying, 'sync_export'::character varying, 'sync_bidirectional'::character varying, 'webhook_received'::character varying, 'notification_email'::character varying, 'notification_slack'::character varying, 'notification_webhook'::character varying, 'api_call'::character varying, 'device_create'::character varying, 'device_update'::character varying, 'device_delete'::character varying, 'other'::character varying])::"text"[]))),
    CONSTRAINT "integration_activity_log_direction_check" CHECK ((("direction")::"text" = ANY ((ARRAY['outgoing'::character varying, 'incoming'::character varying])::"text"[]))),
    CONSTRAINT "integration_activity_log_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['started'::character varying, 'success'::character varying, 'failed'::character varying, 'timeout'::character varying, 'error'::character varying])::"text"[])))
);


ALTER TABLE "public"."integration_activity_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."integration_activity_log" IS 'Comprehensive activity log for all integration operations (outgoing and incoming)';



COMMENT ON COLUMN "public"."integration_activity_log"."direction" IS 'outgoing = calls made by our system, incoming = calls received by our system';



COMMENT ON COLUMN "public"."integration_activity_log"."activity_type" IS 'Type of activity: test, sync, webhook, notification, etc.';



COMMENT ON COLUMN "public"."integration_activity_log"."response_time_ms" IS 'Time taken to complete the activity in milliseconds';



CREATE OR REPLACE VIEW "public"."integration_activity_summary" AS
 SELECT "integration_id",
    "organization_id",
    "direction",
    "activity_type",
    "status",
    "count"(*) AS "total_count",
    "count"(*) FILTER (WHERE (("status")::"text" = 'success'::"text")) AS "success_count",
    "count"(*) FILTER (WHERE (("status")::"text" = ANY ((ARRAY['failed'::character varying, 'error'::character varying, 'timeout'::character varying])::"text"[]))) AS "error_count",
    "avg"("response_time_ms") FILTER (WHERE ("response_time_ms" IS NOT NULL)) AS "avg_response_time_ms",
    "max"("created_at") AS "last_activity_at",
    "date_trunc"('day'::"text", "created_at") AS "activity_date"
   FROM "public"."integration_activity_log"
  GROUP BY "integration_id", "organization_id", "direction", "activity_type", "status", ("date_trunc"('day'::"text", "created_at"));


ALTER VIEW "public"."integration_activity_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."locations" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "address" "text",
    "city" character varying(100),
    "state" character varying(100),
    "country" character varying(100),
    "postal_code" character varying(20),
    "latitude" numeric(10,8),
    "longitude" numeric(11,8),
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mqtt_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "integration_id" "uuid" NOT NULL,
    "topic" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "qos" integer DEFAULT 0,
    "received_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "mqtt_messages_qos_check" CHECK (("qos" = ANY (ARRAY[0, 1, 2])))
);


ALTER TABLE "public"."mqtt_messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."mqtt_messages" IS 'Stores MQTT messages received from broker subscriptions';



CREATE TABLE IF NOT EXISTS "public"."notification_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "integration_id" "uuid" NOT NULL,
    "integration_type" character varying(50) NOT NULL,
    "message" "text" NOT NULL,
    "priority" character varying(20) DEFAULT 'medium'::character varying,
    "status" character varying(50) NOT NULL,
    "sent_at" timestamp with time zone,
    "failed_at" timestamp with time zone,
    "retry_count" integer DEFAULT 0,
    "error_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notification_log_integration_type_check" CHECK ((("integration_type")::"text" = ANY ((ARRAY['email'::character varying, 'slack'::character varying, 'webhook'::character varying])::"text"[]))),
    CONSTRAINT "notification_log_priority_check" CHECK ((("priority")::"text" = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::"text"[]))),
    CONSTRAINT "notification_log_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'sent'::character varying, 'failed'::character varying, 'retrying'::character varying])::"text"[])))
);


ALTER TABLE "public"."notification_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."notification_log" IS 'Audit trail for all notifications sent via Email, Slack, and Webhooks';



CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "alert_id" "uuid",
    "recipient_id" "uuid" NOT NULL,
    "method" "public"."notification_method" NOT NULL,
    "status" "public"."notification_status" DEFAULT 'pending'::"public"."notification_status",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "sent_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_members" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" character varying(50) DEFAULT 'member'::character varying,
    "permissions" "jsonb" DEFAULT '[]'::"jsonb",
    "invited_by" "uuid",
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "organization_members_role_check" CHECK ((("role")::"text" = ANY ((ARRAY['owner'::character varying, 'admin'::character varying, 'member'::character varying])::"text"[])))
);


ALTER TABLE "public"."organization_members" OWNER TO "postgres";


COMMENT ON TABLE "public"."organization_members" IS 'RLS policies updated to prevent recursion. Users can only see their own memberships directly.';



CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "public"."uuid_generate_v4"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "slug" character varying(100) NOT NULL,
    "description" "text",
    "subscription_tier" character varying(50) DEFAULT 'starter'::character varying,
    "is_active" boolean DEFAULT true,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "owner_id" "uuid"
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sync_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "integration_id" "uuid" NOT NULL,
    "operation" character varying(100) NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "status" character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    "payload" "jsonb" NOT NULL,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "next_retry_at" timestamp with time zone,
    "error_message" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sync_queue_operation_check" CHECK ((("operation")::"text" = ANY ((ARRAY['sync_device'::character varying, 'sync_all'::character varying, 'resolve_conflict'::character varying, 'webhook_event'::character varying])::"text"[]))),
    CONSTRAINT "sync_queue_priority_check" CHECK ((("priority" >= 1) AND ("priority" <= 10))),
    CONSTRAINT "sync_queue_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying, 'dead_letter'::character varying])::"text"[])))
);


ALTER TABLE "public"."sync_queue" OWNER TO "postgres";


COMMENT ON TABLE "public"."sync_queue" IS 'Reliable queue for sync operations with retry logic and dead letter handling.';



COMMENT ON COLUMN "public"."sync_queue"."priority" IS 'Queue priority 1-10, higher = more urgent';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" character varying(255) NOT NULL,
    "full_name" character varying(255),
    "role" "public"."user_role" DEFAULT 'user'::"public"."user_role",
    "organization_id" "uuid",
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "last_login" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."golioth_sync_log" ATTACH PARTITION "public"."golioth_sync_log_2025_10" FOR VALUES FROM ('2025-10-01 00:00:00+00') TO ('2025-11-01 00:00:00+00');



ALTER TABLE ONLY "public"."golioth_sync_log" ATTACH PARTITION "public"."golioth_sync_log_2025_11" FOR VALUES FROM ('2025-11-01 00:00:00+00') TO ('2025-12-01 00:00:00+00');



ALTER TABLE ONLY "public"."golioth_sync_log" ATTACH PARTITION "public"."golioth_sync_log_2025_12" FOR VALUES FROM ('2025-12-01 00:00:00+00') TO ('2026-01-01 00:00:00+00');



ALTER TABLE ONLY "public"."golioth_sync_log" ATTACH PARTITION "public"."golioth_sync_log_2026_01" FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2026-02-01 00:00:00+00');



ALTER TABLE ONLY "public"."alerts"
    ADD CONSTRAINT "alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."device_conflicts"
    ADD CONSTRAINT "device_conflicts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."device_data"
    ADD CONSTRAINT "device_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."device_integrations"
    ADD CONSTRAINT "device_integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."device_service_assignments"
    ADD CONSTRAINT "device_service_assignments_device_id_integration_id_key" UNIQUE ("device_id", "integration_id");



ALTER TABLE ONLY "public"."device_service_assignments"
    ADD CONSTRAINT "device_service_assignments_integration_id_external_device_i_key" UNIQUE ("integration_id", "external_device_id");



ALTER TABLE ONLY "public"."device_service_assignments"
    ADD CONSTRAINT "device_service_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."devices"
    ADD CONSTRAINT "devices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."golioth_sync_log"
    ADD CONSTRAINT "golioth_sync_log_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "public"."golioth_sync_log_2025_10"
    ADD CONSTRAINT "golioth_sync_log_2025_10_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "public"."golioth_sync_log_2025_11"
    ADD CONSTRAINT "golioth_sync_log_2025_11_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "public"."golioth_sync_log_2025_12"
    ADD CONSTRAINT "golioth_sync_log_2025_12_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "public"."golioth_sync_log_2026_01"
    ADD CONSTRAINT "golioth_sync_log_2026_01_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "public"."integration_activity_log"
    ADD CONSTRAINT "integration_activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mqtt_messages"
    ADD CONSTRAINT "mqtt_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_log"
    ADD CONSTRAINT "notification_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_user_id_key" UNIQUE ("organization_id", "user_id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."sync_queue"
    ADD CONSTRAINT "sync_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_sync_log_device" ON ONLY "public"."golioth_sync_log" USING "btree" ("device_id") WHERE ("device_id" IS NOT NULL);



CREATE INDEX "golioth_sync_log_2025_10_device_id_idx" ON "public"."golioth_sync_log_2025_10" USING "btree" ("device_id") WHERE ("device_id" IS NOT NULL);



CREATE INDEX "idx_sync_log_integration" ON ONLY "public"."golioth_sync_log" USING "btree" ("integration_id", "status");



CREATE INDEX "golioth_sync_log_2025_10_integration_id_status_idx" ON "public"."golioth_sync_log_2025_10" USING "btree" ("integration_id", "status");



CREATE INDEX "idx_sync_log_org_created" ON ONLY "public"."golioth_sync_log" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "golioth_sync_log_2025_10_organization_id_created_at_idx" ON "public"."golioth_sync_log_2025_10" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "idx_sync_log_status" ON ONLY "public"."golioth_sync_log" USING "btree" ("status") WHERE (("status")::"text" = ANY ((ARRAY['started'::character varying, 'processing'::character varying])::"text"[]));



CREATE INDEX "golioth_sync_log_2025_10_status_idx" ON "public"."golioth_sync_log_2025_10" USING "btree" ("status") WHERE (("status")::"text" = ANY ((ARRAY['started'::character varying, 'processing'::character varying])::"text"[]));



CREATE INDEX "golioth_sync_log_2025_11_device_id_idx" ON "public"."golioth_sync_log_2025_11" USING "btree" ("device_id") WHERE ("device_id" IS NOT NULL);



CREATE INDEX "golioth_sync_log_2025_11_integration_id_status_idx" ON "public"."golioth_sync_log_2025_11" USING "btree" ("integration_id", "status");



CREATE INDEX "golioth_sync_log_2025_11_organization_id_created_at_idx" ON "public"."golioth_sync_log_2025_11" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "golioth_sync_log_2025_11_status_idx" ON "public"."golioth_sync_log_2025_11" USING "btree" ("status") WHERE (("status")::"text" = ANY ((ARRAY['started'::character varying, 'processing'::character varying])::"text"[]));



CREATE INDEX "golioth_sync_log_2025_12_device_id_idx" ON "public"."golioth_sync_log_2025_12" USING "btree" ("device_id") WHERE ("device_id" IS NOT NULL);



CREATE INDEX "golioth_sync_log_2025_12_integration_id_status_idx" ON "public"."golioth_sync_log_2025_12" USING "btree" ("integration_id", "status");



CREATE INDEX "golioth_sync_log_2025_12_organization_id_created_at_idx" ON "public"."golioth_sync_log_2025_12" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "golioth_sync_log_2025_12_status_idx" ON "public"."golioth_sync_log_2025_12" USING "btree" ("status") WHERE (("status")::"text" = ANY ((ARRAY['started'::character varying, 'processing'::character varying])::"text"[]));



CREATE INDEX "golioth_sync_log_2026_01_device_id_idx" ON "public"."golioth_sync_log_2026_01" USING "btree" ("device_id") WHERE ("device_id" IS NOT NULL);



CREATE INDEX "golioth_sync_log_2026_01_integration_id_status_idx" ON "public"."golioth_sync_log_2026_01" USING "btree" ("integration_id", "status");



CREATE INDEX "golioth_sync_log_2026_01_organization_id_created_at_idx" ON "public"."golioth_sync_log_2026_01" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "golioth_sync_log_2026_01_status_idx" ON "public"."golioth_sync_log_2026_01" USING "btree" ("status") WHERE (("status")::"text" = ANY ((ARRAY['started'::character varying, 'processing'::character varying])::"text"[]));



CREATE INDEX "idx_activity_log_direction" ON "public"."integration_activity_log" USING "btree" ("direction", "status");



CREATE INDEX "idx_activity_log_failed" ON "public"."integration_activity_log" USING "btree" ("organization_id", "created_at" DESC) WHERE (("status")::"text" = ANY ((ARRAY['failed'::character varying, 'error'::character varying, 'timeout'::character varying])::"text"[]));



CREATE INDEX "idx_activity_log_integration_created" ON "public"."integration_activity_log" USING "btree" ("integration_id", "created_at" DESC);



CREATE INDEX "idx_activity_log_org_created" ON "public"."integration_activity_log" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "idx_activity_log_status" ON "public"."integration_activity_log" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_activity_log_type" ON "public"."integration_activity_log" USING "btree" ("activity_type", "status");



CREATE INDEX "idx_activity_log_user" ON "public"."integration_activity_log" USING "btree" ("user_id", "created_at" DESC) WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_alerts_created_at" ON "public"."alerts" USING "btree" ("created_at");



CREATE INDEX "idx_alerts_device_created" ON "public"."alerts" USING "btree" ("device_id", "created_at" DESC) WHERE ("device_id" IS NOT NULL);



CREATE INDEX "idx_alerts_device_id" ON "public"."alerts" USING "btree" ("device_id");



CREATE INDEX "idx_alerts_is_resolved" ON "public"."alerts" USING "btree" ("is_resolved");



CREATE INDEX "idx_alerts_org_created" ON "public"."alerts" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "idx_alerts_org_severity_resolved" ON "public"."alerts" USING "btree" ("organization_id", "severity", "is_resolved", "created_at" DESC);



CREATE INDEX "idx_alerts_org_unresolved" ON "public"."alerts" USING "btree" ("organization_id", "severity" DESC, "created_at" DESC) WHERE ("is_resolved" = false);



CREATE INDEX "idx_alerts_organization_id" ON "public"."alerts" USING "btree" ("organization_id");



CREATE INDEX "idx_alerts_severity" ON "public"."alerts" USING "btree" ("severity");



CREATE INDEX "idx_assignments_device" ON "public"."device_service_assignments" USING "btree" ("device_id");



CREATE INDEX "idx_assignments_external" ON "public"."device_service_assignments" USING "btree" ("external_device_id");



CREATE INDEX "idx_assignments_integration" ON "public"."device_service_assignments" USING "btree" ("integration_id");



CREATE INDEX "idx_assignments_retry" ON "public"."device_service_assignments" USING "btree" ("next_retry_at") WHERE ((("sync_status")::"text" = 'error'::"text") AND ("sync_retry_count" < 5));



CREATE INDEX "idx_assignments_sync_status" ON "public"."device_service_assignments" USING "btree" ("sync_status", "sync_enabled");



CREATE INDEX "idx_audit_logs_created_at" ON "public"."audit_logs" USING "btree" ("created_at");



CREATE INDEX "idx_audit_logs_org_timestamp" ON "public"."audit_logs" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "idx_audit_logs_organization_id" ON "public"."audit_logs" USING "btree" ("organization_id");



CREATE INDEX "idx_audit_logs_user_id" ON "public"."audit_logs" USING "btree" ("user_id");



CREATE INDEX "idx_audit_logs_user_timestamp" ON "public"."audit_logs" USING "btree" ("user_id", "created_at" DESC) WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_conflicts_created" ON "public"."device_conflicts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_conflicts_device" ON "public"."device_conflicts" USING "btree" ("device_id", "resolution_status");



CREATE INDEX "idx_conflicts_pending" ON "public"."device_conflicts" USING "btree" ("resolution_status") WHERE (("resolution_status")::"text" = 'pending'::"text");



CREATE INDEX "idx_conflicts_sync_log" ON "public"."device_conflicts" USING "btree" ("sync_log_id") WHERE ("sync_log_id" IS NOT NULL);



CREATE INDEX "idx_departments_location" ON "public"."departments" USING "btree" ("location_id");



CREATE INDEX "idx_device_data_device_id" ON "public"."device_data" USING "btree" ("device_id");



CREATE INDEX "idx_device_data_device_timestamp" ON "public"."device_data" USING "btree" ("device_id", "timestamp");



CREATE INDEX "idx_device_data_sensor_type" ON "public"."device_data" USING "btree" ("sensor_type");



CREATE INDEX "idx_device_data_timestamp" ON "public"."device_data" USING "btree" ("timestamp");



CREATE INDEX "idx_device_integrations_org_status" ON "public"."device_integrations" USING "btree" ("organization_id", "status");



CREATE INDEX "idx_device_integrations_organization_id" ON "public"."device_integrations" USING "btree" ("organization_id");



CREATE INDEX "idx_device_integrations_status" ON "public"."device_integrations" USING "btree" ("status");



CREATE INDEX "idx_device_integrations_type" ON "public"."device_integrations" USING "btree" ("integration_type");



CREATE UNIQUE INDEX "idx_device_integrations_unique" ON "public"."device_integrations" USING "btree" ("organization_id", "integration_type", "name");



CREATE INDEX "idx_devices_deleted_at" ON "public"."devices" USING "btree" ("deleted_at");



CREATE INDEX "idx_devices_department" ON "public"."devices" USING "btree" ("department_id") WHERE ("department_id" IS NOT NULL);



CREATE INDEX "idx_devices_department_id" ON "public"."devices" USING "btree" ("department_id");



CREATE INDEX "idx_devices_external_id" ON "public"."devices" USING "btree" ("external_device_id") WHERE ("external_device_id" IS NOT NULL);



CREATE INDEX "idx_devices_integration" ON "public"."devices" USING "btree" ("integration_id") WHERE ("integration_id" IS NOT NULL);



CREATE INDEX "idx_devices_last_seen" ON "public"."devices" USING "btree" ("last_seen");



CREATE INDEX "idx_devices_location" ON "public"."devices" USING "btree" ("location_id") WHERE ("location_id" IS NOT NULL);



CREATE INDEX "idx_devices_location_id" ON "public"."devices" USING "btree" ("location_id");



CREATE INDEX "idx_devices_org_battery" ON "public"."devices" USING "btree" ("organization_id", "battery_level") WHERE (("battery_level" IS NOT NULL) AND ("battery_level" < 20));



CREATE INDEX "idx_devices_org_last_seen" ON "public"."devices" USING "btree" ("organization_id", "last_seen" DESC);



CREATE INDEX "idx_devices_org_signal" ON "public"."devices" USING "btree" ("organization_id", "signal_strength") WHERE (("signal_strength" IS NOT NULL) AND ("signal_strength" < '-70'::integer));



CREATE INDEX "idx_devices_org_status" ON "public"."devices" USING "btree" ("organization_id", "status") WHERE ("status" IS NOT NULL);



CREATE INDEX "idx_devices_org_status_last_seen" ON "public"."devices" USING "btree" ("organization_id", "status", "last_seen" DESC);



CREATE INDEX "idx_devices_organization_id" ON "public"."devices" USING "btree" ("organization_id");



CREATE INDEX "idx_devices_serial_number" ON "public"."devices" USING "btree" ("serial_number") WHERE ("serial_number" IS NOT NULL);



CREATE INDEX "idx_devices_status" ON "public"."devices" USING "btree" ("status");



CREATE INDEX "idx_locations_org" ON "public"."locations" USING "btree" ("organization_id");



CREATE INDEX "idx_mqtt_messages_integration" ON "public"."mqtt_messages" USING "btree" ("integration_id");



CREATE INDEX "idx_mqtt_messages_org" ON "public"."mqtt_messages" USING "btree" ("organization_id");



CREATE INDEX "idx_mqtt_messages_received" ON "public"."mqtt_messages" USING "btree" ("received_at" DESC);



CREATE INDEX "idx_mqtt_messages_topic" ON "public"."mqtt_messages" USING "btree" ("topic");



CREATE INDEX "idx_notification_log_integration" ON "public"."notification_log" USING "btree" ("integration_id");



CREATE INDEX "idx_notification_log_org" ON "public"."notification_log" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "idx_notification_log_status" ON "public"."notification_log" USING "btree" ("status") WHERE (("status")::"text" = ANY ((ARRAY['pending'::character varying, 'retrying'::character varying])::"text"[]));



CREATE INDEX "idx_notification_log_type" ON "public"."notification_log" USING "btree" ("integration_type", "status");



CREATE INDEX "idx_notifications_organization_id" ON "public"."notifications" USING "btree" ("organization_id");



CREATE INDEX "idx_notifications_pending" ON "public"."notifications" USING "btree" ("method", "created_at") WHERE ("status" = 'pending'::"public"."notification_status");



CREATE INDEX "idx_notifications_recipient_created" ON "public"."notifications" USING "btree" ("recipient_id", "created_at" DESC);



CREATE INDEX "idx_notifications_recipient_id" ON "public"."notifications" USING "btree" ("recipient_id");



CREATE INDEX "idx_notifications_status" ON "public"."notifications" USING "btree" ("status");



CREATE INDEX "idx_organization_members_organization_id" ON "public"."organization_members" USING "btree" ("organization_id");



CREATE INDEX "idx_organization_members_role" ON "public"."organization_members" USING "btree" ("role");



CREATE INDEX "idx_organization_members_user_id" ON "public"."organization_members" USING "btree" ("user_id");



CREATE INDEX "idx_organizations_slug" ON "public"."organizations" USING "btree" ("slug") WHERE ("is_active" = true);



CREATE INDEX "idx_queue_integration" ON "public"."sync_queue" USING "btree" ("integration_id", "status");



CREATE INDEX "idx_queue_org" ON "public"."sync_queue" USING "btree" ("organization_id", "status");



CREATE INDEX "idx_queue_pending" ON "public"."sync_queue" USING "btree" ("priority" DESC, "created_at") WHERE (("status")::"text" = 'pending'::"text");



CREATE INDEX "idx_queue_retry" ON "public"."sync_queue" USING "btree" ("next_retry_at") WHERE ((("status")::"text" = 'failed'::"text") AND ("retry_count" < "max_retries"));



CREATE INDEX "idx_users_email" ON "public"."users" USING "btree" ("email");



CREATE INDEX "idx_users_org_role" ON "public"."users" USING "btree" ("organization_id", "role") WHERE ("is_active" = true);



CREATE INDEX "idx_users_organization_id" ON "public"."users" USING "btree" ("organization_id");



CREATE INDEX "idx_users_role" ON "public"."users" USING "btree" ("role");



ALTER INDEX "public"."idx_sync_log_device" ATTACH PARTITION "public"."golioth_sync_log_2025_10_device_id_idx";



ALTER INDEX "public"."idx_sync_log_integration" ATTACH PARTITION "public"."golioth_sync_log_2025_10_integration_id_status_idx";



ALTER INDEX "public"."idx_sync_log_org_created" ATTACH PARTITION "public"."golioth_sync_log_2025_10_organization_id_created_at_idx";



ALTER INDEX "public"."golioth_sync_log_pkey" ATTACH PARTITION "public"."golioth_sync_log_2025_10_pkey";



ALTER INDEX "public"."idx_sync_log_status" ATTACH PARTITION "public"."golioth_sync_log_2025_10_status_idx";



ALTER INDEX "public"."idx_sync_log_device" ATTACH PARTITION "public"."golioth_sync_log_2025_11_device_id_idx";



ALTER INDEX "public"."idx_sync_log_integration" ATTACH PARTITION "public"."golioth_sync_log_2025_11_integration_id_status_idx";



ALTER INDEX "public"."idx_sync_log_org_created" ATTACH PARTITION "public"."golioth_sync_log_2025_11_organization_id_created_at_idx";



ALTER INDEX "public"."golioth_sync_log_pkey" ATTACH PARTITION "public"."golioth_sync_log_2025_11_pkey";



ALTER INDEX "public"."idx_sync_log_status" ATTACH PARTITION "public"."golioth_sync_log_2025_11_status_idx";



ALTER INDEX "public"."idx_sync_log_device" ATTACH PARTITION "public"."golioth_sync_log_2025_12_device_id_idx";



ALTER INDEX "public"."idx_sync_log_integration" ATTACH PARTITION "public"."golioth_sync_log_2025_12_integration_id_status_idx";



ALTER INDEX "public"."idx_sync_log_org_created" ATTACH PARTITION "public"."golioth_sync_log_2025_12_organization_id_created_at_idx";



ALTER INDEX "public"."golioth_sync_log_pkey" ATTACH PARTITION "public"."golioth_sync_log_2025_12_pkey";



ALTER INDEX "public"."idx_sync_log_status" ATTACH PARTITION "public"."golioth_sync_log_2025_12_status_idx";



ALTER INDEX "public"."idx_sync_log_device" ATTACH PARTITION "public"."golioth_sync_log_2026_01_device_id_idx";



ALTER INDEX "public"."idx_sync_log_integration" ATTACH PARTITION "public"."golioth_sync_log_2026_01_integration_id_status_idx";



ALTER INDEX "public"."idx_sync_log_org_created" ATTACH PARTITION "public"."golioth_sync_log_2026_01_organization_id_created_at_idx";



ALTER INDEX "public"."golioth_sync_log_pkey" ATTACH PARTITION "public"."golioth_sync_log_2026_01_pkey";



ALTER INDEX "public"."idx_sync_log_status" ATTACH PARTITION "public"."golioth_sync_log_2026_01_status_idx";



CREATE OR REPLACE TRIGGER "trigger_auto_generate_webhook_config" BEFORE INSERT OR UPDATE ON "public"."device_integrations" FOR EACH ROW EXECUTE FUNCTION "public"."auto_generate_webhook_config"();



CREATE OR REPLACE TRIGGER "update_alerts_updated_at" BEFORE UPDATE ON "public"."alerts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_assignments_updated_at" BEFORE UPDATE ON "public"."device_service_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_departments_updated_at" BEFORE UPDATE ON "public"."departments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_device_integrations_updated_at" BEFORE UPDATE ON "public"."device_integrations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_device_integrations_updated_at_trigger" BEFORE UPDATE ON "public"."device_integrations" FOR EACH ROW EXECUTE FUNCTION "public"."update_device_integrations_updated_at"();



CREATE OR REPLACE TRIGGER "update_devices_updated_at" BEFORE UPDATE ON "public"."devices" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_locations_updated_at" BEFORE UPDATE ON "public"."locations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_notification_log_updated_at" BEFORE UPDATE ON "public"."notification_log" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_organizations_updated_at" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_queue_updated_at" BEFORE UPDATE ON "public"."sync_queue" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."alerts"
    ADD CONSTRAINT "alerts_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."alerts"
    ADD CONSTRAINT "alerts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alerts"
    ADD CONSTRAINT "alerts_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."device_conflicts"
    ADD CONSTRAINT "device_conflicts_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."device_conflicts"
    ADD CONSTRAINT "device_conflicts_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."device_data"
    ADD CONSTRAINT "device_data_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."device_integrations"
    ADD CONSTRAINT "device_integrations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."device_service_assignments"
    ADD CONSTRAINT "device_service_assignments_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."device_service_assignments"
    ADD CONSTRAINT "device_service_assignments_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."device_integrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."devices"
    ADD CONSTRAINT "devices_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."devices"
    ADD CONSTRAINT "devices_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."device_integrations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."devices"
    ADD CONSTRAINT "devices_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."devices"
    ADD CONSTRAINT "devices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE "public"."golioth_sync_log"
    ADD CONSTRAINT "golioth_sync_log_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE "public"."golioth_sync_log"
    ADD CONSTRAINT "golioth_sync_log_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE SET NULL;



ALTER TABLE "public"."golioth_sync_log"
    ADD CONSTRAINT "golioth_sync_log_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."device_integrations"("id") ON DELETE CASCADE;



ALTER TABLE "public"."golioth_sync_log"
    ADD CONSTRAINT "golioth_sync_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_activity_log"
    ADD CONSTRAINT "integration_activity_log_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."device_integrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_activity_log"
    ADD CONSTRAINT "integration_activity_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_activity_log"
    ADD CONSTRAINT "integration_activity_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mqtt_messages"
    ADD CONSTRAINT "mqtt_messages_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."device_integrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mqtt_messages"
    ADD CONSTRAINT "mqtt_messages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_log"
    ADD CONSTRAINT "notification_log_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."device_integrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_log"
    ADD CONSTRAINT "notification_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."sync_queue"
    ADD CONSTRAINT "sync_queue_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."device_integrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sync_queue"
    ADD CONSTRAINT "sync_queue_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE "public"."alerts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "alerts_select_authenticated" ON "public"."alerts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "alerts_update_authenticated" ON "public"."alerts" FOR UPDATE TO "authenticated" USING (true);



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_select_authenticated" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."departments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "departments_delete_authenticated" ON "public"."departments" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "departments_insert_authenticated" ON "public"."departments" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "departments_select_authenticated" ON "public"."departments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "departments_update_authenticated" ON "public"."departments" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."device_conflicts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."device_data" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "device_data_select_authenticated" ON "public"."device_data" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."device_integrations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "device_integrations_delete_authenticated" ON "public"."device_integrations" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "device_integrations_insert_authenticated" ON "public"."device_integrations" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "device_integrations_select_authenticated" ON "public"."device_integrations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "device_integrations_update_authenticated" ON "public"."device_integrations" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."device_service_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."devices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "devices_delete_authenticated" ON "public"."devices" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "devices_insert_authenticated" ON "public"."devices" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "devices_select_authenticated" ON "public"."devices" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "devices_update_authenticated" ON "public"."devices" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."golioth_sync_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."integration_activity_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "integration_activity_log_select_authenticated" ON "public"."integration_activity_log" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."locations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "locations_delete_authenticated" ON "public"."locations" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "locations_insert_authenticated" ON "public"."locations" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "locations_select_authenticated" ON "public"."locations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "locations_update_authenticated" ON "public"."locations" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."mqtt_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mqtt_messages_select_authenticated" ON "public"."mqtt_messages" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."notification_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notification_log_select_authenticated" ON "public"."notification_log" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_select_own" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("recipient_id" = "auth"."uid"()));



CREATE POLICY "org_members_delete_authenticated" ON "public"."organization_members" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "org_members_insert_authenticated" ON "public"."organization_members" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "org_members_select_own" ON "public"."organization_members" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "org_members_update_authenticated" ON "public"."organization_members" FOR UPDATE TO "authenticated" USING (true);



ALTER TABLE "public"."organization_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organizations_select_authenticated" ON "public"."organizations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "organizations_update_authenticated" ON "public"."organizations" FOR UPDATE TO "authenticated" USING (true);



ALTER TABLE "public"."sync_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_insert_authenticated" ON "public"."users" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "users_select_authenticated" ON "public"."users" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "users_update_own" ON "public"."users" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."auto_generate_webhook_config"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_generate_webhook_config"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_generate_webhook_config"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_integration_logs"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_integration_logs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_integration_logs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."complete_integration_activity"("p_log_id" "uuid", "p_status" character varying, "p_response_status" integer, "p_response_body" "jsonb", "p_response_time_ms" integer, "p_error_message" "text", "p_error_code" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."complete_integration_activity"("p_log_id" "uuid", "p_status" character varying, "p_response_status" integer, "p_response_body" "jsonb", "p_response_time_ms" integer, "p_error_message" "text", "p_error_code" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_integration_activity"("p_log_id" "uuid", "p_status" character varying, "p_response_status" integer, "p_response_body" "jsonb", "p_response_time_ms" integer, "p_error_message" "text", "p_error_code" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_webhook_secret"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_webhook_secret"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_webhook_secret"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_webhook_url"("integration_id" "uuid", "integration_type" "text", "supabase_url" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_webhook_url"("integration_id" "uuid", "integration_type" "text", "supabase_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_webhook_url"("integration_id" "uuid", "integration_type" "text", "supabase_url" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pending_conflicts"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_pending_conflicts"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pending_conflicts"("org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_sync_stats"("org_id" "uuid", "integration_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_sync_stats"("org_id" "uuid", "integration_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_sync_stats"("org_id" "uuid", "integration_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_integration_activity"("p_organization_id" "uuid", "p_integration_id" "uuid", "p_direction" character varying, "p_activity_type" character varying, "p_method" character varying, "p_endpoint" "text", "p_status" character varying, "p_user_id" "uuid", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_integration_activity"("p_organization_id" "uuid", "p_integration_id" "uuid", "p_direction" character varying, "p_activity_type" character varying, "p_method" character varying, "p_endpoint" "text", "p_status" character varying, "p_user_id" "uuid", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_integration_activity"("p_organization_id" "uuid", "p_integration_id" "uuid", "p_direction" character varying, "p_activity_type" character varying, "p_method" character varying, "p_endpoint" "text", "p_status" character varying, "p_user_id" "uuid", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_device_integrations_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_device_integrations_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_device_integrations_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."uuid_generate_v4"() TO "anon";
GRANT ALL ON FUNCTION "public"."uuid_generate_v4"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."uuid_generate_v4"() TO "service_role";


















GRANT ALL ON TABLE "public"."alerts" TO "anon";
GRANT ALL ON TABLE "public"."alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."alerts" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."departments" TO "anon";
GRANT ALL ON TABLE "public"."departments" TO "authenticated";
GRANT ALL ON TABLE "public"."departments" TO "service_role";



GRANT ALL ON TABLE "public"."device_conflicts" TO "anon";
GRANT ALL ON TABLE "public"."device_conflicts" TO "authenticated";
GRANT ALL ON TABLE "public"."device_conflicts" TO "service_role";



GRANT ALL ON TABLE "public"."device_data" TO "anon";
GRANT ALL ON TABLE "public"."device_data" TO "authenticated";
GRANT ALL ON TABLE "public"."device_data" TO "service_role";



GRANT ALL ON TABLE "public"."device_integrations" TO "anon";
GRANT ALL ON TABLE "public"."device_integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."device_integrations" TO "service_role";



GRANT ALL ON TABLE "public"."device_service_assignments" TO "anon";
GRANT ALL ON TABLE "public"."device_service_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."device_service_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."devices" TO "anon";
GRANT ALL ON TABLE "public"."devices" TO "authenticated";
GRANT ALL ON TABLE "public"."devices" TO "service_role";



GRANT ALL ON TABLE "public"."golioth_sync_log" TO "anon";
GRANT ALL ON TABLE "public"."golioth_sync_log" TO "authenticated";
GRANT ALL ON TABLE "public"."golioth_sync_log" TO "service_role";



GRANT ALL ON TABLE "public"."golioth_sync_log_2025_10" TO "anon";
GRANT ALL ON TABLE "public"."golioth_sync_log_2025_10" TO "authenticated";
GRANT ALL ON TABLE "public"."golioth_sync_log_2025_10" TO "service_role";



GRANT ALL ON TABLE "public"."golioth_sync_log_2025_11" TO "anon";
GRANT ALL ON TABLE "public"."golioth_sync_log_2025_11" TO "authenticated";
GRANT ALL ON TABLE "public"."golioth_sync_log_2025_11" TO "service_role";



GRANT ALL ON TABLE "public"."golioth_sync_log_2025_12" TO "anon";
GRANT ALL ON TABLE "public"."golioth_sync_log_2025_12" TO "authenticated";
GRANT ALL ON TABLE "public"."golioth_sync_log_2025_12" TO "service_role";



GRANT ALL ON TABLE "public"."golioth_sync_log_2026_01" TO "anon";
GRANT ALL ON TABLE "public"."golioth_sync_log_2026_01" TO "authenticated";
GRANT ALL ON TABLE "public"."golioth_sync_log_2026_01" TO "service_role";



GRANT ALL ON TABLE "public"."integration_activity_log" TO "anon";
GRANT ALL ON TABLE "public"."integration_activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."integration_activity_summary" TO "anon";
GRANT ALL ON TABLE "public"."integration_activity_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_activity_summary" TO "service_role";



GRANT ALL ON TABLE "public"."locations" TO "anon";
GRANT ALL ON TABLE "public"."locations" TO "authenticated";
GRANT ALL ON TABLE "public"."locations" TO "service_role";



GRANT ALL ON TABLE "public"."mqtt_messages" TO "anon";
GRANT ALL ON TABLE "public"."mqtt_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."mqtt_messages" TO "service_role";



GRANT ALL ON TABLE "public"."notification_log" TO "anon";
GRANT ALL ON TABLE "public"."notification_log" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_log" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."organization_members" TO "anon";
GRANT ALL ON TABLE "public"."organization_members" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_members" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."sync_queue" TO "anon";
GRANT ALL ON TABLE "public"."sync_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."sync_queue" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























