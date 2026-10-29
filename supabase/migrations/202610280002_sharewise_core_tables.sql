-- ==============================================================================
-- ShareWise Migration: 202610280002_sharewise_core_tables.sql
-- Module: Database, Authentication, and Permissions (Core Domain Tables)
--
-- Security Design & Architecture:
-- 1. Preservation of Audit History & Referential Integrity:
--    - resources.owner_id uses ON DELETE RESTRICT (profiles cannot be deleted if
--      they own resources; resources must be decommissioned or transferred first).
--    - bookings.resource_id uses ON DELETE RESTRICT (resources cannot be dropped
--      if bookings exist; resource lifecycle uses status = 'inactive'/'maintenance').
--    - bookings.requester_id uses ON DELETE RESTRICT to preserve historical accountability.
--    - condition_reports and incidents reference bookings with ON DELETE RESTRICT.
--    - audit_events retains actor, resource, and booking foreign keys with ON DELETE SET NULL
--      so audit logs persist permanently regardless of lifecycle transitions.
--
-- 2. Mediated Booking Lifecycle (RPC Exclusivity):
--    - Direct INSERT on public.bookings is REVOKED from authenticated and anon.
--    - No direct client INSERT policy exists on public.bookings.
--    - Booking creation must be performed via Member 3's trusted SECURITY DEFINER
--      RPC (request_booking), which validates resource status, time ranges,
--      eligibility, availability blocks, and conflict detection.
--    - Direct UPDATE on bookings is REVOKED from authenticated users for lifecycle fields
--      (status, decision_by, decision_at, decision_reason, checked_in_at, returned_at).
--    - A defense-in-depth BEFORE UPDATE trigger (handle_booking_update_protection) enforces
--      that status and lifecycle transitions can ONLY occur if authorized via an internal
--      transaction flag ('sharewise.authorized_booking_transition' = 'true') set inside
--      trusted SECURITY DEFINER RPCs after authorization checks. There is no
--      service_role-specific bypass; lifecycle-field changes use the same flag check.
--
-- 3. Column-Level Grant Hardening:
--    - resources: Authenticated users can insert resources where owner_id = auth.uid(),
--      and owners can update only operational attributes (name, description, category,
--      location, image_path, usage_rules, required_training, max_booking_minutes, status).
--      Direct update of owner_id, created_at, or id is denied.
--    - availability_blocks: Owners can update start_time, end_time, status, reason.
--      Cannot reassign resource_id or id.
--    - incidents: Reporters can only update 'description' while open. Reviewer resolution
--      fields (status, reviewer_id, resolution_notes) are denied to ordinary clients and
--      must be updated by an authorized reviewer/RPC.
--    - eligibility_records: Direct UPDATE is completely revoked. Users can only INSERT
--      verification requests with status = 'pending_review' and verified_by IS NULL.
--      Self-verification is blocked by CHECK constraint and RLS WITH CHECK.
--
-- 4. Append-Only Audit Logging:
--    - Direct INSERT, UPDATE, and DELETE on audit_events are completely revoked from
--      all client roles (PUBLIC, anon, authenticated).
--    - Only trusted SECURITY DEFINER functions, system triggers, or service_role can
--      write audit events.
--    - Authenticated users can only SELECT audit logs relevant to resources they own
--      or bookings they requested.
--
-- 5. Search Path Hardening:
--    - All functions declare 'SET search_path = ''' and use schema-qualified names.
--    - EXECUTE privileges are revoked from PUBLIC, anon, and authenticated.
-- 6. Availability-Block Concurrency:
--    - A trigger locks parent resources and rejects active blocks overlapping
--      pending, approved, checked_out, or overdue bookings.
--    - Booking RPCs use the same parent-resource lock before booking writes.
-- ==============================================================================

-- ==============================================================================
-- 1. RESOURCES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.resources (
    id pg_catalog.uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    owner_id pg_catalog.uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    name pg_catalog.text NOT NULL,
    description pg_catalog.text NOT NULL DEFAULT '',
    category pg_catalog.text NOT NULL,
    location pg_catalog.text NOT NULL,
    image_path pg_catalog.text,
    usage_rules pg_catalog.text,
    required_training pg_catalog.text,
    max_booking_minutes pg_catalog.int4 CHECK (max_booking_minutes IS NULL OR max_booking_minutes > 0),
    status pg_catalog.text NOT NULL DEFAULT 'active',
    created_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now(),
    updated_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT chk_resources_status CHECK (status IN ('active', 'inactive', 'maintenance'))
);

CREATE INDEX IF NOT EXISTS idx_resources_owner_id ON public.resources(owner_id);
CREATE INDEX IF NOT EXISTS idx_resources_status ON public.resources(status);
CREATE INDEX IF NOT EXISTS idx_resources_category ON public.resources(category);

-- ==============================================================================
-- 2. AVAILABILITY BLOCKS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.availability_blocks (
    id pg_catalog.uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    resource_id pg_catalog.uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
    start_time pg_catalog.timestamptz NOT NULL,
    end_time pg_catalog.timestamptz NOT NULL,
    status pg_catalog.text NOT NULL DEFAULT 'active',
    reason pg_catalog.text,
    created_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT chk_availability_time_range CHECK (start_time < end_time),
    CONSTRAINT chk_availability_status CHECK (status IN ('active', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_availability_blocks_resource_id ON public.availability_blocks(resource_id);
CREATE INDEX IF NOT EXISTS idx_availability_blocks_time_range ON public.availability_blocks(resource_id, start_time, end_time);

-- ==============================================================================
-- 3. BOOKINGS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.bookings (
    id pg_catalog.uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    resource_id pg_catalog.uuid NOT NULL REFERENCES public.resources(id) ON DELETE RESTRICT,
    requester_id pg_catalog.uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    start_time pg_catalog.timestamptz NOT NULL,
    end_time pg_catalog.timestamptz NOT NULL,
    purpose pg_catalog.text NOT NULL,
    status pg_catalog.text NOT NULL DEFAULT 'pending',
    decision_by pg_catalog.uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    decision_at pg_catalog.timestamptz,
    decision_reason pg_catalog.text,
    checked_in_at pg_catalog.timestamptz,
    returned_at pg_catalog.timestamptz,
    created_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now(),
    updated_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT chk_bookings_time_range CHECK (start_time < end_time),
    CONSTRAINT chk_bookings_status CHECK (
        status IN ('pending', 'approved', 'rejected', 'waitlisted', 'checked_out', 'returned', 'cancelled', 'overdue')
    )
);

CREATE INDEX IF NOT EXISTS idx_bookings_resource_id ON public.bookings(resource_id);
CREATE INDEX IF NOT EXISTS idx_bookings_requester_id ON public.bookings(requester_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_resource_time ON public.bookings(resource_id, start_time, end_time);

-- ==============================================================================
-- 4. ELIGIBILITY RECORDS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.eligibility_records (
    id pg_catalog.uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    user_id pg_catalog.uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    requirement_type pg_catalog.text NOT NULL,
    status pg_catalog.text NOT NULL DEFAULT 'pending_review',
    verified_by pg_catalog.uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    verified_at pg_catalog.timestamptz,
    expires_at pg_catalog.timestamptz,
    created_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT chk_eligibility_status CHECK (
        status IN ('pending_review', 'verified', 'rejected', 'expired')
    ),
    CONSTRAINT chk_eligibility_no_self_verification CHECK (
        user_id IS DISTINCT FROM verified_by
    )
);

CREATE INDEX IF NOT EXISTS idx_eligibility_records_user_id ON public.eligibility_records(user_id);
CREATE INDEX IF NOT EXISTS idx_eligibility_records_req_type ON public.eligibility_records(requirement_type);

-- ==============================================================================
-- 5. CONDITION REPORTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.condition_reports (
    id pg_catalog.uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    booking_id pg_catalog.uuid NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
    reporter_id pg_catalog.uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    report_type pg_catalog.text NOT NULL,
    notes pg_catalog.text NOT NULL,
    image_path pg_catalog.text,
    created_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT chk_condition_report_type CHECK (report_type IN ('initial', 'final'))
);

CREATE INDEX IF NOT EXISTS idx_condition_reports_booking_id ON public.condition_reports(booking_id);
CREATE INDEX IF NOT EXISTS idx_condition_reports_reporter_id ON public.condition_reports(reporter_id);

-- ==============================================================================
-- 6. INCIDENTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.incidents (
    id pg_catalog.uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    booking_id pg_catalog.uuid NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
    reporter_id pg_catalog.uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    category pg_catalog.text NOT NULL,
    description pg_catalog.text NOT NULL,
    status pg_catalog.text NOT NULL DEFAULT 'open',
    reviewer_id pg_catalog.uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    resolution_notes pg_catalog.text,
    created_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now(),
    updated_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT chk_incidents_status CHECK (status IN ('open', 'under_review', 'resolved', 'dismissed'))
);

CREATE INDEX IF NOT EXISTS idx_incidents_booking_id ON public.incidents(booking_id);
CREATE INDEX IF NOT EXISTS idx_incidents_reporter_id ON public.incidents(reporter_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents(status);

-- ==============================================================================
-- 7. AUDIT EVENTS TABLE (Append-Only)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.audit_events (
    id pg_catalog.uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    actor_id pg_catalog.uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    resource_id pg_catalog.uuid REFERENCES public.resources(id) ON DELETE SET NULL,
    booking_id pg_catalog.uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
    event_type pg_catalog.text NOT NULL,
    reason pg_catalog.text,
    metadata pg_catalog.jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_actor_id ON public.audit_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_resource_id ON public.audit_events(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_booking_id ON public.audit_events(booking_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_event_type ON public.audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON public.audit_events(created_at DESC);

-- ============================================================================
-- AVAILABILITY BLOCK CONFLICT GUARD
-- All block writes lock their parent resource before checking active bookings.
-- Booking RPCs take the same resource lock before creating or transitioning a
-- booking. This serializes both directions of the race under READ COMMITTED.
-- Active blocks may not overlap pending, approved, checked_out, or overdue
-- bookings. Cancelled blocks may overlap bookings.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.guard_availability_block_booking_conflict()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_first_resource_id pg_catalog.uuid;
    v_second_resource_id pg_catalog.uuid;
BEGIN
    -- UPDATE/DELETE already hold the block row lock when this trigger runs.
    -- Moving a block locks both parent resources in UUID order.
    IF TG_OP = 'DELETE' THEN
        PERFORM 1 FROM public.resources r
        WHERE r.id = OLD.resource_id
        FOR UPDATE;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.resource_id = NEW.resource_id THEN
            PERFORM 1 FROM public.resources r
            WHERE r.id = NEW.resource_id
            FOR UPDATE;
        ELSE
            IF OLD.resource_id < NEW.resource_id THEN
                v_first_resource_id := OLD.resource_id;
                v_second_resource_id := NEW.resource_id;
            ELSE
                v_first_resource_id := NEW.resource_id;
                v_second_resource_id := OLD.resource_id;
            END IF;
            PERFORM 1 FROM public.resources r
            WHERE r.id = v_first_resource_id
            FOR UPDATE;
            PERFORM 1 FROM public.resources r
            WHERE r.id = v_second_resource_id
            FOR UPDATE;
        END IF;
    ELSE
        PERFORM 1 FROM public.resources r
        WHERE r.id = NEW.resource_id
        FOR UPDATE;
    END IF;

    IF NEW.status = 'active' AND EXISTS (
        SELECT 1
        FROM public.bookings b
        WHERE b.resource_id = NEW.resource_id
          AND b.status IN ('pending', 'approved', 'checked_out', 'overdue')
          AND NEW.start_time < b.end_time
          AND b.start_time < NEW.end_time
    ) THEN
        RAISE EXCEPTION 'Active availability block overlaps an active booking.'
            USING ERRCODE = '23P01';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_availability_block_booking_conflict() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_availability_block_booking_conflict() FROM anon;
REVOKE ALL ON FUNCTION public.guard_availability_block_booking_conflict() FROM authenticated;

DROP TRIGGER IF EXISTS trg_availability_blocks_booking_conflict ON public.availability_blocks;
CREATE TRIGGER trg_availability_blocks_booking_conflict
    BEFORE INSERT OR UPDATE OR DELETE ON public.availability_blocks
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_availability_block_booking_conflict();

-- ==============================================================================
-- TRIGGER HELPER: Generic updated_at bump
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_generic_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at := pg_catalog.now();
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_generic_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_generic_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.handle_generic_updated_at() FROM authenticated;

-- Attach updated_at triggers
DROP TRIGGER IF EXISTS trg_resources_updated_at ON public.resources;
CREATE TRIGGER trg_resources_updated_at
    BEFORE UPDATE ON public.resources
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_generic_updated_at();

DROP TRIGGER IF EXISTS trg_bookings_updated_at ON public.bookings;
CREATE TRIGGER trg_bookings_updated_at
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_generic_updated_at();

DROP TRIGGER IF EXISTS trg_incidents_updated_at ON public.incidents;
CREATE TRIGGER trg_incidents_updated_at
    BEFORE UPDATE ON public.incidents
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_generic_updated_at();

-- ==============================================================================
-- DEFENSE-IN-DEPTH TRIGGER: Protect booking status and lifecycle fields
-- Normal client UPDATE statements cannot change status, decision attributes,
-- or checkin/checkout timestamps.
-- Authorized booking RPCs (Member 3) set local transaction configuration:
--   PERFORM pg_catalog.set_config('sharewise.authorized_booking_transition', 'true', true);
-- This allows the RPC to transition status cleanly while rejecting raw client calls.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_booking_update_protection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_is_authorized_transition pg_catalog.text;
BEGIN
    -- Prevent changing primary key, resource, requester, or created_at
    IF NEW.id IS DISTINCT FROM OLD.id THEN
        RAISE EXCEPTION 'Modification of booking ID is not permitted.';
    END IF;
    IF NEW.resource_id IS DISTINCT FROM OLD.resource_id THEN
        RAISE EXCEPTION 'Modification of booking resource_id is not permitted.';
    END IF;
    IF NEW.requester_id IS DISTINCT FROM OLD.requester_id THEN
        RAISE EXCEPTION 'Modification of booking requester_id is not permitted.';
    END IF;
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Modification of created_at timestamp is not permitted.';
    END IF;

    -- Check if this execution occurs inside an authorized RPC workflow
    v_is_authorized_transition := pg_catalog.current_setting('sharewise.authorized_booking_transition', true);

    -- If not running inside an authorized transition workflow, forbid changes to lifecycle fields
    IF v_is_authorized_transition IS DISTINCT FROM 'true' THEN
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            RAISE EXCEPTION 'Direct client updates to booking status are restricted. Use authorized booking actions.';
        END IF;
        IF NEW.decision_by IS DISTINCT FROM OLD.decision_by
           OR NEW.decision_at IS DISTINCT FROM OLD.decision_at
           OR NEW.decision_reason IS DISTINCT FROM OLD.decision_reason THEN
            RAISE EXCEPTION 'Direct client updates to booking decision fields are restricted.';
        END IF;
        IF NEW.checked_in_at IS DISTINCT FROM OLD.checked_in_at
           OR NEW.returned_at IS DISTINCT FROM OLD.returned_at THEN
            RAISE EXCEPTION 'Direct client updates to check-in or return timestamps are restricted.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_booking_update_protection() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_booking_update_protection() FROM anon;
REVOKE ALL ON FUNCTION public.handle_booking_update_protection() FROM authenticated;

DROP TRIGGER IF EXISTS trg_bookings_protect_lifecycle ON public.bookings;
CREATE TRIGGER trg_bookings_protect_lifecycle
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_booking_update_protection();

-- ==============================================================================
-- DEFENSE-IN-DEPTH TRIGGER: Protect resources immutable fields
-- Resource owners may update details, but cannot reassign owner_id or created_at.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_resource_update_protection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
        RAISE EXCEPTION 'Modification of resource ID is not permitted.';
    END IF;
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
        RAISE EXCEPTION 'Modification of resource owner_id is not permitted.';
    END IF;
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Modification of created_at timestamp is not permitted.';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_resource_update_protection() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_resource_update_protection() FROM anon;
REVOKE ALL ON FUNCTION public.handle_resource_update_protection() FROM authenticated;

DROP TRIGGER IF EXISTS trg_resources_protect_fields ON public.resources;
CREATE TRIGGER trg_resources_protect_fields
    BEFORE UPDATE ON public.resources
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_resource_update_protection();

-- ==============================================================================
-- DEFENSE-IN-DEPTH TRIGGER: Protect incidents review fields
-- Ordinary reporters can edit description while open, but cannot change
-- booking_id, reporter_id, created_at, or reviewer/status resolution fields directly.
-- Authorized reviewers or review RPCs set 'sharewise.authorized_incident_review' = 'true'.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_incident_update_protection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_is_authorized_review pg_catalog.text;
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
        RAISE EXCEPTION 'Modification of incident ID is not permitted.';
    END IF;
    IF NEW.booking_id IS DISTINCT FROM OLD.booking_id THEN
        RAISE EXCEPTION 'Modification of incident booking_id is not permitted.';
    END IF;
    IF NEW.reporter_id IS DISTINCT FROM OLD.reporter_id THEN
        RAISE EXCEPTION 'Modification of incident reporter_id is not permitted.';
    END IF;
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Modification of created_at timestamp is not permitted.';
    END IF;

    v_is_authorized_review := pg_catalog.current_setting('sharewise.authorized_incident_review', true);

    IF v_is_authorized_review IS DISTINCT FROM 'true' THEN
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            RAISE EXCEPTION 'Direct client updates to incident status are restricted to authorized reviewers.';
        END IF;
        IF NEW.reviewer_id IS DISTINCT FROM OLD.reviewer_id
           OR NEW.resolution_notes IS DISTINCT FROM OLD.resolution_notes THEN
            RAISE EXCEPTION 'Direct client updates to incident review fields are restricted.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_incident_update_protection() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_incident_update_protection() FROM anon;
REVOKE ALL ON FUNCTION public.handle_incident_update_protection() FROM authenticated;

DROP TRIGGER IF EXISTS trg_incidents_protect_fields ON public.incidents;
CREATE TRIGGER trg_incidents_protect_fields
    BEFORE UPDATE ON public.incidents
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_incident_update_protection();

-- ==============================================================================
-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ==============================================================================
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eligibility_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.condition_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- TABLE PRIVILEGES / LEAST-PRIVILEGE GRANTS
-- ==============================================================================
-- Default revoke on all core tables
REVOKE ALL ON TABLE public.resources FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.availability_blocks FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.bookings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.eligibility_records FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.condition_reports FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.incidents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.audit_events FROM PUBLIC, anon, authenticated;

-- 1. Resources:
-- Authenticated users can view active resources.
-- Authenticated users can create resources (trigger and RLS enforce owner_id = auth.uid()).
-- Column-level update permissions allow modifying resource attributes only (cannot change id, owner_id, created_at).
GRANT SELECT, INSERT ON TABLE public.resources TO authenticated;
GRANT UPDATE (name, description, category, location, image_path, usage_rules, required_training, max_booking_minutes, status)
    ON TABLE public.resources TO authenticated;

-- 2. Availability Blocks:
-- Authenticated users can view blocks. Owners can insert and update block scheduling.
GRANT SELECT, INSERT, DELETE ON TABLE public.availability_blocks TO authenticated;
GRANT UPDATE (start_time, end_time, status, reason)
    ON TABLE public.availability_blocks TO authenticated;

-- 3. Bookings:
-- Authenticated users can view bookings where they are a party.
-- Direct INSERT is NOT GRANTED. Booking creation is mediated strictly by the 'request_booking' RPC.
-- Column-level UPDATE on bookings is limited to 'purpose' only. Time fields (start_time, end_time)
-- are NOT user-editable for MVP. Time editing is unsupported and must be performed by the requester
-- cancelling and resubmitting, or via a dedicated edit RPC that re-validates availability and conflicts.
-- Status and decision updates are restricted and mediated by booking RPCs.
GRANT SELECT ON TABLE public.bookings TO authenticated;
GRANT UPDATE (purpose) ON TABLE public.bookings TO authenticated;

-- 4. Eligibility Records:
-- Authenticated users can view their own records and insert initial verification requests.
-- Direct client UPDATE and DELETE are NOT GRANTED. Trusted reviewer RPC / workflow will verify.
GRANT SELECT, INSERT ON TABLE public.eligibility_records TO authenticated;

-- 5. Condition Reports:
-- Booking participants can view reports. INSERT is RPC-only: check_in_booking and
-- return_booking create initial/final reports as part of the authorized lifecycle.
-- Direct client INSERT, UPDATE, and DELETE are not granted.
GRANT SELECT ON TABLE public.condition_reports TO authenticated;

-- 6. Incidents:
-- Booking participants can view and file incidents.
-- Reporters receive column-level update on 'description' only while open.
GRANT SELECT, INSERT ON TABLE public.incidents TO authenticated;
GRANT UPDATE (description) ON TABLE public.incidents TO authenticated;

-- 7. Audit Events:
-- Strictly append-only by trusted database functions/triggers.
-- No client INSERT, UPDATE, or DELETE grants.
-- Authenticated users can SELECT audit events relevant to their own resources or bookings.
GRANT SELECT ON TABLE public.audit_events TO authenticated;

-- ==============================================================================
-- RLS POLICIES
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Resources RLS Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view resources" ON public.resources;
DROP POLICY IF EXISTS "Resource owners can insert resources" ON public.resources;
DROP POLICY IF EXISTS "Resource owners can update their resources" ON public.resources;

CREATE POLICY "Authenticated users can view resources"
    ON public.resources
    FOR SELECT
    TO authenticated
    USING (
        status = 'active'
        OR (SELECT auth.uid()) = owner_id
    );

CREATE POLICY "Resource owners can insert resources"
    ON public.resources
    FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE POLICY "Resource owners can update their resources"
    ON public.resources
    FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = owner_id)
    WITH CHECK ((SELECT auth.uid()) = owner_id);

-- Note: DELETE policy omitted on resources to prevent accidental cascading data loss.
-- Resources are deactivated by setting status = 'inactive' or 'maintenance'.

-- ------------------------------------------------------------------------------
-- 2. Availability Blocks RLS Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view availability blocks" ON public.availability_blocks;
DROP POLICY IF EXISTS "Resource owners can insert availability blocks" ON public.availability_blocks;
DROP POLICY IF EXISTS "Resource owners can update availability blocks" ON public.availability_blocks;
DROP POLICY IF EXISTS "Resource owners can delete availability blocks" ON public.availability_blocks;

CREATE POLICY "Authenticated users can view availability blocks"
    ON public.availability_blocks
    FOR SELECT
    TO authenticated
    USING (
        status = 'active'
        OR EXISTS (
            SELECT 1 FROM public.resources r
            WHERE r.id = availability_blocks.resource_id
              AND r.owner_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Resource owners can insert availability blocks"
    ON public.availability_blocks
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.resources r
            WHERE r.id = availability_blocks.resource_id
              AND r.owner_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Resource owners can update availability blocks"
    ON public.availability_blocks
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.resources r
            WHERE r.id = availability_blocks.resource_id
              AND r.owner_id = (SELECT auth.uid())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.resources r
            WHERE r.id = availability_blocks.resource_id
              AND r.owner_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Resource owners can delete availability blocks"
    ON public.availability_blocks
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.resources r
            WHERE r.id = availability_blocks.resource_id
              AND r.owner_id = (SELECT auth.uid())
        )
    );

-- ------------------------------------------------------------------------------
-- 3. Bookings RLS Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Parties can view bookings" ON public.bookings;
DROP POLICY IF EXISTS "Requesters can insert bookings" ON public.bookings;
DROP POLICY IF EXISTS "Requesters can update pending bookings" ON public.bookings;

-- Users can view bookings where they are the requester OR the resource owner
CREATE POLICY "Parties can view bookings"
    ON public.bookings
    FOR SELECT
    TO authenticated
    USING (
        requester_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.resources r
            WHERE r.id = bookings.resource_id
              AND r.owner_id = (SELECT auth.uid())
        )
    );

-- Notice: Direct client INSERT policy is deliberately absent.
-- All booking creations must pass through Member 3's request_booking RPC,
-- which runs as SECURITY DEFINER and performs mandatory checks.

-- Requesters can update their own booking 'purpose' only while still pending.
-- Note: start_time and end_time are NOT directly editable by authenticated users (no column grant).
-- This RLS policy gate (row match) is still needed for the 'purpose' column-level UPDATE grant.
CREATE POLICY "Requesters can update pending bookings"
    ON public.bookings
    FOR UPDATE
    TO authenticated
    USING (
        requester_id = (SELECT auth.uid())
        AND status = 'pending'
    )
    WITH CHECK (
        requester_id = (SELECT auth.uid())
        AND status = 'pending'
    );

-- ------------------------------------------------------------------------------
-- 4. Eligibility Records RLS Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own eligibility records" ON public.eligibility_records;
DROP POLICY IF EXISTS "Users can request eligibility review" ON public.eligibility_records;

-- Users can only view their own eligibility records
CREATE POLICY "Users can view own eligibility records"
    ON public.eligibility_records
    FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- Users can submit their own eligibility request in 'pending_review' status.
-- Cannot self-verify: verified_by, verified_at, and expires_at must be NULL on insert.
CREATE POLICY "Users can request eligibility review"
    ON public.eligibility_records
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = (SELECT auth.uid())
        AND status = 'pending_review'
        AND verified_by IS NULL
        AND verified_at IS NULL
        AND expires_at IS NULL
    );

-- ------------------------------------------------------------------------------
-- 5. Condition Reports RLS Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Booking parties can view condition reports" ON public.condition_reports;
DROP POLICY IF EXISTS "Booking parties can insert condition reports" ON public.condition_reports;

-- Condition reports are visible only to the booking requester and resource owner
CREATE POLICY "Booking parties can view condition reports"
    ON public.condition_reports
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.bookings b
            JOIN public.resources r ON r.id = b.resource_id
            WHERE b.id = condition_reports.booking_id
              AND (b.requester_id = (SELECT auth.uid()) OR r.owner_id = (SELECT auth.uid()))
        )
    );

-- Direct condition-report INSERT is intentionally unavailable to authenticated clients.
-- Lifecycle RPCs write reports under their SECURITY DEFINER owner privileges.

-- ------------------------------------------------------------------------------
-- 6. Incidents RLS Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Involved parties can view incidents" ON public.incidents;
DROP POLICY IF EXISTS "Involved parties can file incidents" ON public.incidents;
DROP POLICY IF EXISTS "Reporter can edit open incident" ON public.incidents;

-- Incidents can be seen by the reporter, reviewer, booking requester, or resource owner
CREATE POLICY "Involved parties can view incidents"
    ON public.incidents
    FOR SELECT
    TO authenticated
    USING (
        reporter_id = (SELECT auth.uid())
        OR reviewer_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.bookings b
            JOIN public.resources r ON r.id = b.resource_id
            WHERE b.id = incidents.booking_id
              AND (b.requester_id = (SELECT auth.uid()) OR r.owner_id = (SELECT auth.uid()))
        )
    );

-- Booking participants can file an incident report
CREATE POLICY "Involved parties can file incidents"
    ON public.incidents
    FOR INSERT
    TO authenticated
    WITH CHECK (
        reporter_id = (SELECT auth.uid())
        AND status = 'open'
        AND reviewer_id IS NULL
        AND resolution_notes IS NULL
        AND EXISTS (
            SELECT 1 FROM public.bookings b
            JOIN public.resources r ON r.id = b.resource_id
            WHERE b.id = incidents.booking_id
              AND (b.requester_id = (SELECT auth.uid()) OR r.owner_id = (SELECT auth.uid()))
        )
    );

-- Reporter can update incident description while still open
CREATE POLICY "Reporter can edit open incident"
    ON public.incidents
    FOR UPDATE
    TO authenticated
    USING (
        reporter_id = (SELECT auth.uid())
        AND status = 'open'
    )
    WITH CHECK (
        reporter_id = (SELECT auth.uid())
        AND status = 'open'
    );

-- ------------------------------------------------------------------------------
-- 7. Audit Events RLS Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Relevant parties can view audit events" ON public.audit_events;

-- Users can only inspect audit events if they were the actor, or if the event
-- references a resource they own or a booking they requested
CREATE POLICY "Relevant parties can view audit events"
    ON public.audit_events
    FOR SELECT
    TO authenticated
    USING (
        actor_id = (SELECT auth.uid())
        OR (
            resource_id IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM public.resources r
                WHERE r.id = audit_events.resource_id
                  AND r.owner_id = (SELECT auth.uid())
            )
        )
        OR (
            booking_id IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM public.bookings b
                WHERE b.id = audit_events.booking_id
                  AND b.requester_id = (SELECT auth.uid())
            )
        )
    );
