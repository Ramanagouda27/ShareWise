-- ==============================================================================
-- ShareWise Migration: 202610280003_booking_rpcs.sql
-- Module: Database, Authentication, and Permissions (Booking RPC Procedures)
--
-- Functions implemented:
-- 1. request_booking(p_resource_id, p_start_time, p_end_time, p_purpose)
-- 2. review_booking(p_booking_id, p_decision, p_reason)
-- 3. check_in_booking(p_booking_id, p_initial_condition_notes)
-- 4. return_booking(p_booking_id, p_final_condition_notes)
-- 5. cancel_booking(p_booking_id)
--
-- Security & Integration Architecture:
-- 1. Contract Alignment:
--    - Returns jsonb in the exact shape of BookingRpcResponse<T>:
--      { success: true, code: 'OK', message: text, data: object }
--      { success: false, code: text, message: text, data: null }
--    - Error codes match src/booking/types.ts & src/booking/errors.ts:
--      'UNAUTHENTICATED', 'NOT_AUTHORISED', 'RESOURCE_UNAVAILABLE',
--      'INELIGIBLE', 'INVALID_TIME_RANGE', 'BOOKING_CONFLICT',
--      'INVALID_STATUS_TRANSITION'
--
-- 2. Concurrency & Conflict Prevention:
--    - Uses the parent resource row as the common transaction lock for booking
--      requests, booking transitions, and availability-block writes.
--    - Lock order for booking transitions is resource first, then booking.
--    - Conflicting statuses in ShareWise: 'pending', 'approved', 'checked_out', 'overdue'.
--    - Checks availability_blocks (active blocks ensure or block resource scheduling).
--
-- 3. Lifecycle Protection Trigger Coordination:
--    - Sets local transaction setting:
--      PERFORM pg_catalog.set_config('sharewise.authorized_booking_transition', 'true', true);
--      prior to executing UPDATE on public.bookings.
--
-- 4. Audit Trail & Condition Reporting:
--    - Automatically writes append-only rows to public.audit_events inside the transaction.
--    - check_in_booking creates public.condition_reports (report_type = 'initial').
--    - return_booking creates public.condition_reports (report_type = 'final').
--
-- 5. Security Hardening:
--    - SECURITY DEFINER with SET search_path = ''
--    - Revoke all from PUBLIC and anon; grant EXECUTE to authenticated.
-- ==============================================================================

-- ==============================================================================
-- 1. RPC: request_booking
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.request_booking(
    p_resource_id pg_catalog.uuid,
    p_start_time pg_catalog.timestamptz,
    p_end_time pg_catalog.timestamptz,
    p_purpose pg_catalog.text
)
RETURNS pg_catalog.jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_id pg_catalog.uuid;
    v_resource public.resources%ROWTYPE;
    v_conflict_count pg_catalog.int4;
    v_eligibility_count pg_catalog.int4;
    v_new_booking public.bookings%ROWTYPE;
    v_clean_purpose pg_catalog.text;
BEGIN
    -- 1. Authenticate caller
    v_actor_id := (SELECT auth.uid());
    IF v_actor_id IS NULL THEN
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'UNAUTHENTICATED',
            'message', 'Please sign in to continue.',
            'data', NULL
        )::jsonb;
    END IF;

    -- 2. Validate clean input & time range
    v_clean_purpose := pg_catalog.btrim(COALESCE(p_purpose, ''));
    IF v_clean_purpose = '' THEN
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'INVALID_TIME_RANGE',
            'message', 'Please provide a valid booking purpose.',
            'data', NULL
        )::jsonb;
    END IF;

    IF p_start_time IS NULL OR p_end_time IS NULL OR p_end_time <= p_start_time OR p_start_time <= pg_catalog.now() THEN
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'INVALID_TIME_RANGE',
            'message', 'Please select a valid booking time range.',
            'data', NULL
        )::jsonb;
    END IF;


    -- Enforce the same 30-minute minimum as the frontend; callers can bypass UI validation.
    IF p_end_time - p_start_time < INTERVAL '30 minutes' THEN
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'INVALID_TIME_RANGE',
            'message', 'Booking duration must be at least 30 minutes.',
            'data', NULL
        )::jsonb;
    END IF;

    -- 3. Lock resource row to prevent concurrent race conditions
    SELECT * INTO v_resource
    FROM public.resources
    WHERE id = p_resource_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'RESOURCE_UNAVAILABLE',
            'message', 'This equipment is currently unavailable.',
            'data', NULL
        )::jsonb;
    END IF;

    -- 4. Check resource operational status
    IF v_resource.status IS DISTINCT FROM 'active' THEN
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'RESOURCE_UNAVAILABLE',
            'message', 'This equipment is currently unavailable.',
            'data', NULL
        )::jsonb;
    END IF;

    -- 5. Check maximum booking duration if defined
    -- Use ceiling division to avoid rounding down: e.g. 121 minutes at a 120-minute limit
    -- would incorrectly pass with round() but is correctly rejected with ceiling.
    IF v_resource.max_booking_minutes IS NOT NULL THEN
        IF pg_catalog.ceil(EXTRACT(EPOCH FROM (p_end_time - p_start_time)) / 60.0) > v_resource.max_booking_minutes THEN
            RETURN pg_catalog.json_build_object(
                'success', false,
                'code', 'INVALID_TIME_RANGE',
                'message', 'Booking duration exceeds maximum allowed time.',
                'data', NULL
            )::jsonb;
        END IF;
    END IF;

    -- 6. Check for active availability blocks overlapping the requested interval
    IF EXISTS (
        SELECT 1
        FROM public.availability_blocks
        WHERE resource_id = p_resource_id
          AND status = 'active'
          AND (p_start_time < end_time AND start_time < p_end_time)
    ) THEN
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'RESOURCE_UNAVAILABLE',
            'message', 'This equipment is currently unavailable.',
            'data', NULL
        )::jsonb;
    END IF;

    -- 7. Check resource-specific eligibility (Only if resource requires training)
    -- Institution verification is optional and out of scope for MVP.
    IF v_resource.required_training IS NOT NULL AND pg_catalog.btrim(v_resource.required_training) <> '' THEN
        SELECT pg_catalog.count(*) INTO v_eligibility_count
        FROM public.eligibility_records
        WHERE user_id = v_actor_id
          AND requirement_type = v_resource.required_training
          AND status = 'verified'
          AND (expires_at IS NULL OR expires_at > pg_catalog.now());

        IF v_eligibility_count = 0 THEN
            RETURN pg_catalog.json_build_object(
                'success', false,
                'code', 'INELIGIBLE',
                'message', 'You are not eligible to book this equipment.',
                'data', NULL
            )::jsonb;
        END IF;
    END IF;

    -- 8. Check for conflicting active bookings
    -- Conflicting statuses: pending, approved, checked_out, overdue
    SELECT pg_catalog.count(*) INTO v_conflict_count
    FROM public.bookings
    WHERE resource_id = p_resource_id
      AND status IN ('pending', 'approved', 'checked_out', 'overdue')
      AND (p_start_time < end_time AND start_time < p_end_time);

    IF v_conflict_count > 0 THEN
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'BOOKING_CONFLICT',
            'message', 'This time slot conflicts with another booking.',
            'data', NULL
        )::jsonb;
    END IF;

    -- 9. Insert new booking directly (under SECURITY DEFINER)
    INSERT INTO public.bookings (
        resource_id,
        requester_id,
        start_time,
        end_time,
        purpose,
        status,
        created_at,
        updated_at
    ) VALUES (
        p_resource_id,
        v_actor_id,
        p_start_time,
        p_end_time,
        v_clean_purpose,
        'pending',
        pg_catalog.now(),
        pg_catalog.now()
    )
    RETURNING * INTO v_new_booking;

    -- 10. Transactional Audit Log
    INSERT INTO public.audit_events (
        actor_id,
        resource_id,
        booking_id,
        event_type,
        reason,
        metadata
    ) VALUES (
        v_actor_id,
        p_resource_id,
        v_new_booking.id,
        'booking_requested',
        'User submitted new booking request',
        pg_catalog.json_build_object(
            'start_time', p_start_time,
            'end_time', p_end_time,
            'purpose', v_clean_purpose
        )::jsonb
    );

    RETURN pg_catalog.json_build_object(
        'success', true,
        'code', 'OK',
        'message', 'Booking requested successfully.',
        'data', pg_catalog.json_build_object(
            'id', v_new_booking.id,
            'resourceId', v_new_booking.resource_id,
            'requesterId', v_new_booking.requester_id,
            'startTime', v_new_booking.start_time,
            'endTime', v_new_booking.end_time,
            'purpose', v_new_booking.purpose,
            'status', v_new_booking.status,
            'createdAt', v_new_booking.created_at
        )
    )::jsonb;
END;
$$;

REVOKE ALL ON FUNCTION public.request_booking(pg_catalog.uuid, pg_catalog.timestamptz, pg_catalog.timestamptz, pg_catalog.text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_booking(pg_catalog.uuid, pg_catalog.timestamptz, pg_catalog.timestamptz, pg_catalog.text) TO authenticated;

-- ==============================================================================
-- 2. RPC: review_booking
-- Handles decisions by resource owner: 'approve', 'reject', 'waitlist'
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.review_booking(
    p_booking_id pg_catalog.uuid,
    p_decision pg_catalog.text,
    p_reason pg_catalog.text DEFAULT NULL
)
RETURNS pg_catalog.jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_id pg_catalog.uuid;
    v_booking public.bookings%ROWTYPE;
    v_resource public.resources%ROWTYPE;
    v_next_status pg_catalog.text;
    v_clean_decision pg_catalog.text;
    v_conflict_count pg_catalog.int4;
    v_previous_status pg_catalog.text;  -- Captures booking status before the UPDATE
BEGIN
    v_actor_id := (SELECT auth.uid());
    IF v_actor_id IS NULL THEN
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'UNAUTHENTICATED',
            'message', 'Please sign in to continue.',
            'data', NULL
        )::jsonb;
    END IF;

    -- Discover the parent without locking, then take locks in the shared order:
    -- resource first, booking second. Availability-block writes use the resource
    -- row as the same serialization point.
    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id;

    IF NOT FOUND THEN
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'NOT_AUTHORISED',
            'message', 'Booking not found or inaccessible.',
            'data', NULL
        )::jsonb;
    END IF;

    SELECT * INTO v_resource
    FROM public.resources
    WHERE id = v_booking.resource_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'RESOURCE_UNAVAILABLE',
            'message', 'This equipment is currently unavailable.',
            'data', NULL
        )::jsonb;
    END IF;

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'NOT_AUTHORISED',
            'message', 'Booking not found or inaccessible.',
            'data', NULL
        )::jsonb;
    END IF;

    IF v_booking.resource_id IS DISTINCT FROM v_resource.id THEN
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'RESOURCE_UNAVAILABLE',
            'message', 'Booking resource changed during review; retry the request.',
            'data', NULL
        )::jsonb;
    END IF;

    IF v_resource.owner_id IS DISTINCT FROM v_actor_id THEN
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'NOT_AUTHORISED',
            'message', 'You are not allowed to perform this action.',
            'data', NULL
        )::jsonb;
    END IF;

    -- Determine allowed transitions per src/booking/rules.ts
    v_clean_decision := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_decision, '')));

    IF v_clean_decision = 'reject'
       AND pg_catalog.btrim(COALESCE(p_reason, '')) = '' THEN
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'INVALID_INPUT',
            'message', 'A rejection reason is required.',
            'data', NULL
        )::jsonb;
    END IF;

    IF v_booking.status = 'pending' THEN
        IF v_clean_decision = 'approve' THEN
            v_next_status := 'approved';
        ELSIF v_clean_decision = 'reject' THEN
            v_next_status := 'rejected';
        ELSIF v_clean_decision = 'waitlist' THEN
            v_next_status := 'waitlisted';
        ELSE
            RETURN pg_catalog.json_build_object(
                'success', false,
                'code', 'INVALID_STATUS_TRANSITION',
                'message', 'This booking can no longer be updated in that way.',
                'data', NULL
            )::jsonb;
        END IF;
    ELSIF v_booking.status = 'waitlisted' THEN
        IF v_clean_decision = 'approve' THEN
            v_next_status := 'approved';
        ELSE
            RETURN pg_catalog.json_build_object(
                'success', false,
                'code', 'INVALID_STATUS_TRANSITION',
                'message', 'This booking can no longer be updated in that way.',
                'data', NULL
            )::jsonb;
        END IF;
    ELSE
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'INVALID_STATUS_TRANSITION',
            'message', 'This booking can no longer be updated in that way.',
            'data', NULL
        )::jsonb;
    END IF;

    -- If approving, check for:
    --   (a) overlapping active availability blocks (RESOURCE_UNAVAILABLE)
    --   (b) conflicting already-approved/checked-out/overdue bookings (BOOKING_CONFLICT)
    -- Both checks are protected by the FOR UPDATE on the parent resource row above,
    -- which serialises concurrent approval attempts on the same resource.
    IF v_next_status = 'approved' THEN
        -- The resource may have become inactive or entered maintenance after the
        -- request was created. Recheck while holding the resource row lock.
        IF v_resource.status IS DISTINCT FROM 'active' THEN
            RETURN pg_catalog.json_build_object(
                'success', false,
                'code', 'RESOURCE_UNAVAILABLE',
                'message', 'This equipment is currently unavailable.',
                'data', NULL
            )::jsonb;
        END IF;

        -- Check active availability block overlap
        IF EXISTS (
            SELECT 1
            FROM public.availability_blocks
            WHERE resource_id = v_booking.resource_id
              AND status = 'active'
              AND (v_booking.start_time < end_time AND start_time < v_booking.end_time)
        ) THEN
            RETURN pg_catalog.json_build_object(
                'success', false,
                'code', 'RESOURCE_UNAVAILABLE',
                'message', 'This equipment is currently unavailable.',
                'data', NULL
            )::jsonb;
        END IF;

        SELECT pg_catalog.count(*) INTO v_conflict_count
        FROM public.bookings
        WHERE resource_id = v_booking.resource_id
          AND id <> v_booking.id
          AND status IN ('approved', 'checked_out', 'overdue')
          AND (v_booking.start_time < end_time AND start_time < v_booking.end_time);

        IF v_conflict_count > 0 THEN
            RETURN pg_catalog.json_build_object(
                'success', false,
                'code', 'BOOKING_CONFLICT',
                'message', 'This time slot conflicts with another booking.',
                'data', NULL
            )::jsonb;
        END IF;
    END IF;

    -- Save previous status BEFORE the UPDATE overwrites v_booking via RETURNING
    v_previous_status := v_booking.status;

    -- Coordinate with trigger: enable authorized transition
    PERFORM pg_catalog.set_config('sharewise.authorized_booking_transition', 'true', true);

    UPDATE public.bookings
    SET status = v_next_status,
        decision_by = v_actor_id,
        decision_at = pg_catalog.now(),
        decision_reason = p_reason,
        updated_at = pg_catalog.now()
    WHERE id = p_booking_id
    RETURNING * INTO v_booking;

    -- Audit event
    INSERT INTO public.audit_events (
        actor_id,
        resource_id,
        booking_id,
        event_type,
        reason,
        metadata
    ) VALUES (
        v_actor_id,
        v_booking.resource_id,
        v_booking.id,
        'booking_' || v_next_status,
        p_reason,
        pg_catalog.json_build_object(
            'decision', v_clean_decision,
            'previous_status', v_previous_status,
            'new_status', v_booking.status
        )::jsonb
    );

    RETURN pg_catalog.json_build_object(
        'success', true,
        'code', 'OK',
        'message', 'Booking reviewed successfully.',
        'data', pg_catalog.json_build_object(
            'id', v_booking.id,
            'resourceId', v_booking.resource_id,
            'requesterId', v_booking.requester_id,
            'startTime', v_booking.start_time,
            'endTime', v_booking.end_time,
            'purpose', v_booking.purpose,
            'status', v_booking.status,
            'createdAt', v_booking.created_at
        )
    )::jsonb;
END;
$$;

REVOKE ALL ON FUNCTION public.review_booking(pg_catalog.uuid, pg_catalog.text, pg_catalog.text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_booking(pg_catalog.uuid, pg_catalog.text, pg_catalog.text) TO authenticated;

-- ==============================================================================
-- 3. RPC: cancel_booking
-- Dedicated cancellation by the requester (from 'pending', 'approved', or 'waitlisted')
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.cancel_booking(
    p_booking_id pg_catalog.uuid
)
RETURNS pg_catalog.jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_id pg_catalog.uuid;
    v_booking public.bookings%ROWTYPE;
BEGIN
    v_actor_id := (SELECT auth.uid());
    IF v_actor_id IS NULL THEN
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'UNAUTHENTICATED',
            'message', 'Please sign in to continue.',
            'data', NULL
        )::jsonb;
    END IF;

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id;

    IF NOT FOUND THEN
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'NOT_AUTHORISED',
            'message', 'Booking not found or inaccessible.',
            'data', NULL
        )::jsonb;
    END IF;

    PERFORM 1
    FROM public.resources r
    WHERE r.id = v_booking.resource_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'RESOURCE_UNAVAILABLE',
            'message', 'This equipment is currently unavailable.',
            'data', NULL
        )::jsonb;
    END IF;

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'NOT_AUTHORISED',
            'message', 'Booking not found or inaccessible.',
            'data', NULL
        )::jsonb;
    END IF;

    -- Only requester (or resource owner) may cancel
    IF v_booking.requester_id IS DISTINCT FROM v_actor_id THEN
        -- Allow resource owner as fallback if needed, else reject
        IF NOT EXISTS (
            SELECT 1 FROM public.resources r
            WHERE r.id = v_booking.resource_id AND r.owner_id = v_actor_id
        ) THEN
            RETURN pg_catalog.json_build_object(
                'success', false,
                'code', 'NOT_AUTHORISED',
                'message', 'You are not allowed to perform this action.',
                'data', NULL
            )::jsonb;
        END IF;
    END IF;

    -- Transitions per src/booking/rules.ts: pending, approved, waitlisted -> cancelled
    IF v_booking.status NOT IN ('pending', 'approved', 'waitlisted') THEN
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'INVALID_STATUS_TRANSITION',
            'message', 'This booking can no longer be updated in that way.',
            'data', NULL
        )::jsonb;
    END IF;

    PERFORM pg_catalog.set_config('sharewise.authorized_booking_transition', 'true', true);

    UPDATE public.bookings
    SET status = 'cancelled',
        updated_at = pg_catalog.now()
    WHERE id = p_booking_id
    RETURNING * INTO v_booking;

    INSERT INTO public.audit_events (
        actor_id,
        resource_id,
        booking_id,
        event_type,
        reason,
        metadata
    ) VALUES (
        v_actor_id,
        v_booking.resource_id,
        v_booking.id,
        'booking_cancelled',
        'Booking cancelled by participant',
        pg_catalog.json_build_object('cancelled_by', v_actor_id)::jsonb
    );

    RETURN pg_catalog.json_build_object(
        'success', true,
        'code', 'OK',
        'message', 'Booking cancelled successfully.',
        'data', pg_catalog.json_build_object(
            'id', v_booking.id,
            'resourceId', v_booking.resource_id,
            'requesterId', v_booking.requester_id,
            'startTime', v_booking.start_time,
            'endTime', v_booking.end_time,
            'purpose', v_booking.purpose,
            'status', v_booking.status,
            'createdAt', v_booking.created_at
        )
    )::jsonb;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_booking(pg_catalog.uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_booking(pg_catalog.uuid) TO authenticated;

-- ==============================================================================
-- 4. RPC: check_in_booking
-- Transitions approved booking to 'checked_out' and creates initial condition report
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.check_in_booking(
    p_booking_id pg_catalog.uuid,
    p_initial_condition_notes pg_catalog.text DEFAULT NULL
)
RETURNS pg_catalog.jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_id pg_catalog.uuid;
    v_booking public.bookings%ROWTYPE;
    v_resource public.resources%ROWTYPE;
    v_notes pg_catalog.text;
BEGIN
    v_actor_id := (SELECT auth.uid());
    IF v_actor_id IS NULL THEN
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'UNAUTHENTICATED',
            'message', 'Please sign in to continue.',
            'data', NULL
        )::jsonb;
    END IF;

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id;

    IF NOT FOUND THEN
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'NOT_AUTHORISED',
            'message', 'Booking not found or inaccessible.',
            'data', NULL
        )::jsonb;
    END IF;

    PERFORM 1
    FROM public.resources r
    WHERE r.id = v_booking.resource_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'RESOURCE_UNAVAILABLE',
            'message', 'This equipment is currently unavailable.',
            'data', NULL
        )::jsonb;
    END IF;

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'NOT_AUTHORISED',
            'message', 'Booking not found or inaccessible.',
            'data', NULL
        )::jsonb;
    END IF;

    SELECT * INTO v_resource
    FROM public.resources
    WHERE id = v_booking.resource_id;

    -- Only requester or resource owner can execute checkout/checkin
    IF v_booking.requester_id IS DISTINCT FROM v_actor_id AND v_resource.owner_id IS DISTINCT FROM v_actor_id THEN
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'NOT_AUTHORISED',
            'message', 'You are not allowed to perform this action.',
            'data', NULL
        )::jsonb;
    END IF;

    -- Transition check per rules: approved -> checked_out
    IF v_booking.status IS DISTINCT FROM 'approved' THEN
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'INVALID_STATUS_TRANSITION',
            'message', 'This booking can no longer be updated in that way.',
            'data', NULL
        )::jsonb;
    END IF;

    PERFORM pg_catalog.set_config('sharewise.authorized_booking_transition', 'true', true);

    UPDATE public.bookings
    SET status = 'checked_out',
        checked_in_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    WHERE id = p_booking_id
    RETURNING * INTO v_booking;

    -- Condition report creation
    v_notes := COALESCE(pg_catalog.btrim(p_initial_condition_notes), 'Initial condition recorded at checkout.');
    INSERT INTO public.condition_reports (
        booking_id,
        reporter_id,
        report_type,
        notes,
        created_at
    ) VALUES (
        v_booking.id,
        v_actor_id,
        'initial',
        v_notes,
        pg_catalog.now()
    );

    -- Audit log
    INSERT INTO public.audit_events (
        actor_id,
        resource_id,
        booking_id,
        event_type,
        reason,
        metadata
    ) VALUES (
        v_actor_id,
        v_booking.resource_id,
        v_booking.id,
        'booking_checked_out',
        'Equipment checked out',
        pg_catalog.json_build_object('initial_condition_notes', v_notes)::jsonb
    );

    RETURN pg_catalog.json_build_object(
        'success', true,
        'code', 'OK',
        'message', 'Booking checked out successfully.',
        'data', pg_catalog.json_build_object(
            'id', v_booking.id,
            'resourceId', v_booking.resource_id,
            'requesterId', v_booking.requester_id,
            'startTime', v_booking.start_time,
            'endTime', v_booking.end_time,
            'purpose', v_booking.purpose,
            'status', v_booking.status,
            'createdAt', v_booking.created_at
        )
    )::jsonb;
END;
$$;

REVOKE ALL ON FUNCTION public.check_in_booking(pg_catalog.uuid, pg_catalog.text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_in_booking(pg_catalog.uuid, pg_catalog.text) TO authenticated;

-- ==============================================================================
-- 5. RPC: return_booking
-- Transitions checked_out or overdue booking to 'returned' with final condition report
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.return_booking(
    p_booking_id pg_catalog.uuid,
    p_final_condition_notes pg_catalog.text DEFAULT NULL
)
RETURNS pg_catalog.jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_id pg_catalog.uuid;
    v_booking public.bookings%ROWTYPE;
    v_resource public.resources%ROWTYPE;
    v_notes pg_catalog.text;
BEGIN
    v_actor_id := (SELECT auth.uid());
    IF v_actor_id IS NULL THEN
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'UNAUTHENTICATED',
            'message', 'Please sign in to continue.',
            'data', NULL
        )::jsonb;
    END IF;

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id;

    IF NOT FOUND THEN
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'NOT_AUTHORISED',
            'message', 'Booking not found or inaccessible.',
            'data', NULL
        )::jsonb;
    END IF;

    PERFORM 1
    FROM public.resources r
    WHERE r.id = v_booking.resource_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'RESOURCE_UNAVAILABLE',
            'message', 'This equipment is currently unavailable.',
            'data', NULL
        )::jsonb;
    END IF;

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'NOT_AUTHORISED',
            'message', 'Booking not found or inaccessible.',
            'data', NULL
        )::jsonb;
    END IF;

    SELECT * INTO v_resource
    FROM public.resources
    WHERE id = v_booking.resource_id;

    -- Only requester or resource owner can complete return
    IF v_booking.requester_id IS DISTINCT FROM v_actor_id AND v_resource.owner_id IS DISTINCT FROM v_actor_id THEN
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'NOT_AUTHORISED',
            'message', 'You are not allowed to perform this action.',
            'data', NULL
        )::jsonb;
    END IF;

    -- Allowed transitions per src/booking/rules.ts: checked_out -> returned, overdue -> returned
    IF v_booking.status NOT IN ('checked_out', 'overdue') THEN
        RETURN pg_catalog.json_build_object(
            'success', false,
            'code', 'INVALID_STATUS_TRANSITION',
            'message', 'This booking can no longer be updated in that way.',
            'data', NULL
        )::jsonb;
    END IF;

    PERFORM pg_catalog.set_config('sharewise.authorized_booking_transition', 'true', true);

    UPDATE public.bookings
    SET status = 'returned',
        returned_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    WHERE id = p_booking_id
    RETURNING * INTO v_booking;

    -- Condition report creation
    v_notes := COALESCE(pg_catalog.btrim(p_final_condition_notes), 'Final condition recorded on return.');
    INSERT INTO public.condition_reports (
        booking_id,
        reporter_id,
        report_type,
        notes,
        created_at
    ) VALUES (
        v_booking.id,
        v_actor_id,
        'final',
        v_notes,
        pg_catalog.now()
    );

    -- Audit event
    INSERT INTO public.audit_events (
        actor_id,
        resource_id,
        booking_id,
        event_type,
        reason,
        metadata
    ) VALUES (
        v_actor_id,
        v_booking.resource_id,
        v_booking.id,
        'booking_returned',
        'Equipment returned',
        pg_catalog.json_build_object('final_condition_notes', v_notes)::jsonb
    );

    RETURN pg_catalog.json_build_object(
        'success', true,
        'code', 'OK',
        'message', 'Booking returned successfully.',
        'data', pg_catalog.json_build_object(
            'id', v_booking.id,
            'resourceId', v_booking.resource_id,
            'requesterId', v_booking.requester_id,
            'startTime', v_booking.start_time,
            'endTime', v_booking.end_time,
            'purpose', v_booking.purpose,
            'status', v_booking.status,
            'createdAt', v_booking.created_at
        )
    )::jsonb;
END;
$$;

REVOKE ALL ON FUNCTION public.return_booking(pg_catalog.uuid, pg_catalog.text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.return_booking(pg_catalog.uuid, pg_catalog.text) TO authenticated;
