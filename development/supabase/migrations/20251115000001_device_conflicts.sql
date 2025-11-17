-- Create device_conflicts table for bidirectional sync conflict management
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

-- Set table owner
ALTER TABLE "public"."device_conflicts" OWNER TO "postgres";

-- Add table comment
COMMENT ON TABLE "public"."device_conflicts" IS 'Stores conflicts detected during bidirectional sync with resolution workflow.';

-- Add column comment
COMMENT ON COLUMN "public"."device_conflicts"."resolution_strategy" IS 'How conflict was resolved: local_wins, remote_wins, merge, manual';

-- Add primary key
ALTER TABLE ONLY "public"."device_conflicts"
    ADD CONSTRAINT "device_conflicts_pkey" PRIMARY KEY ("id");

-- Add foreign keys
ALTER TABLE ONLY "public"."device_conflicts"
    ADD CONSTRAINT "device_conflicts_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."device_conflicts"
    ADD CONSTRAINT "device_conflicts_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX "idx_conflicts_created" ON "public"."device_conflicts" USING "btree" ("created_at" DESC);

CREATE INDEX "idx_conflicts_device" ON "public"."device_conflicts" USING "btree" ("device_id", "resolution_status");

CREATE INDEX "idx_conflicts_pending" ON "public"."device_conflicts" USING "btree" ("resolution_status") WHERE (("resolution_status")::"text" = 'pending'::"text");

CREATE INDEX "idx_conflicts_sync_log" ON "public"."device_conflicts" USING "btree" ("sync_log_id") WHERE ("sync_log_id" IS NOT NULL);

-- Enable RLS
ALTER TABLE "public"."device_conflicts" ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON TABLE "public"."device_conflicts" TO "anon";
GRANT ALL ON TABLE "public"."device_conflicts" TO "authenticated";
GRANT ALL ON TABLE "public"."device_conflicts" TO "service_role";

-- RLS Policies: Users can view/manage conflicts for devices in their organization
CREATE POLICY "Users can view conflicts in their organization" ON "public"."device_conflicts"
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM "public"."devices" d
            INNER JOIN "public"."organization_members" om ON d.organization_id = om.organization_id
            WHERE d.id = device_conflicts.device_id
            AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert conflicts in their organization" ON "public"."device_conflicts"
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM "public"."devices" d
            INNER JOIN "public"."organization_members" om ON d.organization_id = om.organization_id
            WHERE d.id = device_conflicts.device_id
            AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update conflicts in their organization" ON "public"."device_conflicts"
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM "public"."devices" d
            INNER JOIN "public"."organization_members" om ON d.organization_id = om.organization_id
            WHERE d.id = device_conflicts.device_id
            AND om.user_id = auth.uid()
        )
    );

-- Create RPC function to get pending conflicts for an organization
CREATE OR REPLACE FUNCTION "public"."get_pending_conflicts"("org_id" "uuid") 
RETURNS TABLE(
    "conflict_id" "uuid", 
    "device_id" "uuid", 
    "device_name" character varying, 
    "conflict_type" character varying, 
    "field_name" character varying, 
    "created_at" timestamp with time zone
)
LANGUAGE "plpgsql" 
SECURITY DEFINER
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

-- Set function owner
ALTER FUNCTION "public"."get_pending_conflicts"("org_id" "uuid") OWNER TO "postgres";

-- Grant function permissions
GRANT ALL ON FUNCTION "public"."get_pending_conflicts"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_pending_conflicts"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pending_conflicts"("org_id" "uuid") TO "service_role";
