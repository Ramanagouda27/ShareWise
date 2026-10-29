-- ==============================================================================
-- ShareWise Test Script: booking_rpcs_test.sql
-- Module: Verification of Booking RPCs (Local/Isolated Test Harness)
--
-- Safety Notice:
-- - This script is designed for local / CI isolated database environments ONLY.
-- - DO NOT run against the shared production Supabase project.
-- - Runs inside a clean transaction that rolls back at the end (ROLLBACK),
--   ensuring zero test data persists while returning a clean success status.
--
-- Auth Fixture Note (Fix 4):
-- - public.profiles.id has a FOREIGN KEY to auth.users(id).
-- - Before inserting test profiles, corresponding rows must exist in auth.users.
-- - In a local Supabase environment, auth.users is writeable by the postgres role.
-- - The INSERT below uses ON CONFLICT DO NOTHING so re-runs are safe.
-- - If your test environment does not permit writing to auth.users, use a test
--   seed script or snapshot that populates auth.users before running this file.
--
-- Execution record (2026-10-29): Earlier revision ran in local Docker PostgreSQL.
-- Tests 1-11, 7A, 7B, and 13 passed; Test 12 was intentionally NOT RUN in this DO
-- block because it cannot assume the authenticated role. The separate
-- booking_time_permissions_authenticated.sql test covers that permission check.
-- Test 7C was added after that earlier run. The audit records a later execution
-- of the Test 7C revision in sharewise_predeploy_verify_20261029_1_db: Test 7C
-- reported Passed and the suite ended with ROLLBACK. The trigger and per-RPC
-- authorization checks added afterward have NOT BEEN EXECUTED. Test 12 remains
-- NOT RUN. See docs/database-final-integration-audit.md for recorded results.
-- ==============================================================================

BEGIN;

DO $$
DECLARE
    v_owner_id UUID := '11111111-1111-1111-1111-111111111111'::UUID;
    v_requester_id UUID := '22222222-2222-2222-2222-222222222222'::UUID;
    v_unauthorized_id UUID := '33333333-3333-3333-3333-333333333333'::UUID;
    v_trained_user_id UUID := '44444444-4444-4444-4444-444444444444'::UUID;

    v_resource_id UUID;
    v_trained_resource_id UUID;
    v_booking_id UUID;
    v_blocked_booking_id UUID;
    v_maintenance_booking_id UUID;
    v_conflicting_block_id UUID;
    v_res JSONB;
    v_conflict_res JSONB;
    v_cancel_res JSONB;

    v_report_count INT;
    v_audit_count INT;
    v_prev_status TEXT;
    v_new_status TEXT;
    v_booking_start_time TIMESTAMPTZ;
    v_booking_end_time TIMESTAMPTZ;
    v_block_rejected BOOLEAN;
    v_transition_rejected BOOLEAN;
    v_update_rows INT;
    v_transition_message TEXT;
BEGIN
    RAISE NOTICE '=============================================================';
    RAISE NOTICE 'Starting ShareWise Booking RPC Test Suite (Isolated Harness)';
    RAISE NOTICE '=============================================================';

    -- --------------------------------------------------------------------------
    -- 0. PREREQUISITE FIXTURES SETUP
    -- --------------------------------------------------------------------------
    -- Fix 4: Insert auth.users rows first to satisfy the profiles foreign key.
    -- In a local Supabase environment the postgres role can write to auth.users.
    -- Minimal required columns: id, email, created_at, updated_at, raw_user_meta_data.
    INSERT INTO auth.users (id, email, created_at, updated_at, raw_user_meta_data, role, aud)
    VALUES
        (v_owner_id,         'owner@sharewise.test',        now(), now(), '{"display_name":"Lab Manager (Owner)"}'::jsonb,        'authenticated', 'authenticated'),
        (v_requester_id,     'requester@sharewise.test',    now(), now(), '{"display_name":"Alice Student (Requester)"}'::jsonb,    'authenticated', 'authenticated'),
        (v_unauthorized_id,  'intruder@sharewise.test',     now(), now(), '{"display_name":"Eve Intruder (Unauthorized)"}'::jsonb,  'authenticated', 'authenticated'),
        (v_trained_user_id,  'researcher@sharewise.test',   now(), now(), '{"display_name":"Bob Researcher (Certified)"}'::jsonb,   'authenticated', 'authenticated')
    ON CONFLICT (id) DO NOTHING;

    -- Insert test profiles (now satisfies FK constraint)
    INSERT INTO public.profiles (id, display_name, institution_status)
    VALUES
        (v_owner_id, 'Lab Manager (Owner)', 'verified'),
        (v_requester_id, 'Alice Student (Requester)', 'pending'),
        (v_unauthorized_id, 'Eve Intruder (Unauthorized)', 'pending'),
        (v_trained_user_id, 'Bob Researcher (Certified)', 'verified')
    ON CONFLICT (id) DO NOTHING;

    -- Insert active test resource (no required training)
    INSERT INTO public.resources (
        id, owner_id, name, description, category, location, status, max_booking_minutes
    ) VALUES (
        gen_random_uuid(), v_owner_id, 'Spectrometer A', 'General optical bench', 'lab_equipment', 'Room 101', 'active', 120
    ) RETURNING id INTO v_resource_id;

    -- Insert test resource requiring certified training
    INSERT INTO public.resources (
        id, owner_id, name, description, category, location, status, required_training, max_booking_minutes
    ) VALUES (
        gen_random_uuid(), v_owner_id, 'Confocal Microscope B', 'Laser imaging', 'microscopy', 'Room 204', 'active', 'LASER_SAFETY_CERT_1', 180
    ) RETURNING id INTO v_trained_resource_id;

    -- Insert verified eligibility record for trained user
    INSERT INTO public.eligibility_records (
        id, user_id, requirement_type, status, verified_by, verified_at, expires_at
    ) VALUES (
        gen_random_uuid(), v_trained_user_id, 'LASER_SAFETY_CERT_1', 'verified', v_owner_id, now(), now() + interval '30 days'
    );

    -- ==========================================================================
    -- TEST 1: Unauthenticated request_booking rejection
    -- ==========================================================================
    PERFORM pg_catalog.set_config('request.jwt.claim.sub', '', true);
    v_res := public.request_booking(v_resource_id, now() + interval '1 hour', now() + interval '2 hours', 'Unauthenticated attempt');
    ASSERT (v_res->>'success')::boolean = false, 'Test 1 Failed: Unauthenticated request should fail';
    ASSERT (v_res->>'code') = 'UNAUTHENTICATED', 'Test 1 Failed: Expected UNAUTHENTICATED code';
    ASSERT v_res->>'data' IS NULL, 'Test 1 Failed: Data must be null on failure';
    RAISE NOTICE 'Test 1 Passed: Unauthenticated request rejected.';

    -- ==========================================================================
    -- TEST 2: Successful request_booking by authenticated requester
    -- ==========================================================================
    PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_requester_id::text, true);
    v_res := public.request_booking(v_resource_id, now() + interval '1 hour', now() + interval '2 hours', 'Research project');
    ASSERT (v_res->>'success')::boolean = true, 'Test 2 Failed: Valid request should succeed';
    ASSERT (v_res->>'code') = 'OK', 'Test 2 Failed: Expected OK code';
    v_booking_id := (v_res->'data'->>'id')::UUID;
    ASSERT v_booking_id IS NOT NULL, 'Test 2 Failed: Booking ID missing';
    ASSERT (v_res->'data'->>'status') = 'pending', 'Test 2 Failed: Initial status must be pending';
    ASSERT (v_res->'data'->>'requesterId') = v_requester_id::text, 'Test 2 Failed: Requester ID mismatch';
    RAISE NOTICE 'Test 2 Passed: Booking successfully created in pending status.';

    -- ======================================================================
    -- TEST 2A: Lifecycle trigger rejects a direct update with the flag absent
    -- The suite connection must be the privileged local harness role so this
    -- reaches the trigger instead of failing first on authenticated ACLs.
    -- ======================================================================
    IF pg_catalog.current_setting('sharewise.authorized_booking_transition', true) IS NOT NULL THEN
        RAISE EXCEPTION 'Test 2A requires the lifecycle authorization flag to be absent at suite start.';
    END IF;
    ASSERT pg_catalog.has_column_privilege(
        current_user, 'public.bookings', 'status', 'UPDATE'
    ), 'Test 2A requires the privileged local test harness role to UPDATE bookings.status.';

    v_transition_rejected := false;
    BEGIN
        UPDATE public.bookings SET status = 'cancelled' WHERE id = v_booking_id;
        GET DIAGNOSTICS v_update_rows = ROW_COUNT;
        RAISE EXCEPTION 'Test 2A expected trigger rejection; UPDATE affected % rows.', v_update_rows
            USING ERRCODE = 'P0002';
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        GET STACKED DIAGNOSTICS v_transition_message = MESSAGE_TEXT;
        IF v_transition_message IS DISTINCT FROM
           'Direct client updates to booking status are restricted. Use authorized booking actions.' THEN
            RAISE EXCEPTION 'Test 2A received unexpected P0001 trigger message: %', v_transition_message
                USING ERRCODE = 'P0002';
        END IF;
        v_transition_rejected := true;
    END;
    ASSERT v_transition_rejected, 'Test 2A Failed: trigger did not reject status UPDATE with the flag absent.';
    ASSERT (SELECT status FROM public.bookings WHERE id = v_booking_id) = 'pending',
        'Test 2A Failed: booking changed after absent-flag rejection.';

    -- ======================================================================
    -- TEST 2B: Lifecycle trigger rejects a direct update when flag is false
    -- ======================================================================
    PERFORM pg_catalog.set_config('sharewise.authorized_booking_transition', 'false', true);
    v_transition_rejected := false;
    BEGIN
        UPDATE public.bookings SET status = 'cancelled' WHERE id = v_booking_id;
        GET DIAGNOSTICS v_update_rows = ROW_COUNT;
        RAISE EXCEPTION 'Test 2B expected trigger rejection; UPDATE affected % rows.', v_update_rows
            USING ERRCODE = 'P0002';
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        GET STACKED DIAGNOSTICS v_transition_message = MESSAGE_TEXT;
        IF v_transition_message IS DISTINCT FROM
           'Direct client updates to booking status are restricted. Use authorized booking actions.' THEN
            RAISE EXCEPTION 'Test 2B received unexpected P0001 trigger message: %', v_transition_message
                USING ERRCODE = 'P0002';
        END IF;
        v_transition_rejected := true;
    END;
    ASSERT v_transition_rejected, 'Test 2B Failed: trigger did not reject status UPDATE when the flag was false.';
    ASSERT (SELECT status FROM public.bookings WHERE id = v_booking_id) = 'pending',
        'Test 2B Failed: booking changed after false-flag rejection.';
    RAISE NOTICE 'Tests 2A-2B Passed: lifecycle trigger rejected direct status updates with absent and false authorization flags.';

    -- ==========================================================================
    -- TEST 3: Overlapping booking conflict detection (BOOKING_CONFLICT)
    -- ==========================================================================
    v_conflict_res := public.request_booking(v_resource_id, now() + interval '1 hour 30 mins', now() + interval '2 hours 30 mins', 'Overlapping request');
    ASSERT (v_conflict_res->>'success')::boolean = false, 'Test 3 Failed: Overlapping booking should fail';
    ASSERT (v_conflict_res->>'code') = 'BOOKING_CONFLICT', 'Test 3 Failed: Expected BOOKING_CONFLICT';
    ASSERT v_conflict_res->>'data' IS NULL, 'Test 3 Failed: Data must be null on failure';
    RAISE NOTICE 'Test 3 Passed: Overlapping booking conflict detected and rejected.';

    -- ==========================================================================
    -- TEST 4: Active availability block overlap rejection (RESOURCE_UNAVAILABLE)
    -- ==========================================================================
    INSERT INTO public.availability_blocks (
        resource_id, start_time, end_time, status, reason
    ) VALUES (
        v_resource_id, now() + interval '10 hours', now() + interval '12 hours', 'active', 'Scheduled Calibration'
    );

    v_res := public.request_booking(v_resource_id, now() + interval '10 hours 30 mins', now() + interval '11 hours 30 mins', 'During calibration');
    ASSERT (v_res->>'success')::boolean = false, 'Test 4 Failed: Request during availability block should fail';
    ASSERT (v_res->>'code') = 'RESOURCE_UNAVAILABLE', 'Test 4 Failed: Expected RESOURCE_UNAVAILABLE';
    ASSERT v_res->>'data' IS NULL, 'Test 4 Failed: Data must be null on failure';
    RAISE NOTICE 'Test 4 Passed: Active availability block conflict rejected as RESOURCE_UNAVAILABLE.';

    -- ==========================================================================
    -- TEST 5: Eligibility enforcement on equipment requiring certification
    -- ==========================================================================
    -- 5A: Requester lacks training -> INELIGIBLE
    PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_requester_id::text, true);
    v_res := public.request_booking(v_trained_resource_id, now() + interval '2 hours', now() + interval '3 hours', 'Attempt without training');
    ASSERT (v_res->>'success')::boolean = false, 'Test 5A Failed: Ineligible request should fail';
    ASSERT (v_res->>'code') = 'INELIGIBLE', 'Test 5A Failed: Expected INELIGIBLE code';

    -- 5B: Certified user books trained resource -> OK
    PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_trained_user_id::text, true);
    v_res := public.request_booking(v_trained_resource_id, now() + interval '2 hours', now() + interval '3 hours', 'Certified research run');
    ASSERT (v_res->>'success')::boolean = true, 'Test 5B Failed: Eligible certified request should succeed';
    ASSERT (v_res->>'code') = 'OK', 'Test 5B Failed: Expected OK code';
    RAISE NOTICE 'Test 5 Passed: Resource eligibility enforced accurately.';

    -- ==========================================================================
    -- TEST 6: Unauthorized review attempt (intruder trying to approve)
    -- ==========================================================================
    PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_unauthorized_id::text, true);
    v_res := public.review_booking(v_booking_id, 'approve', 'Approved by intruder');
    ASSERT (v_res->>'success')::boolean = false, 'Test 6 Failed: Unauthorized review should fail';
    ASSERT (v_res->>'code') = 'NOT_AUTHORISED', 'Test 6 Failed: Expected NOT_AUTHORISED';
    ASSERT v_res->>'data' IS NULL, 'Test 6 Failed: Data must be null on failure';
    RAISE NOTICE 'Test 6 Passed: Unauthorized reviewer rejected.';

    -- ==========================================================================
    -- TEST 7: Legitimate review_booking approval by resource owner
    -- Also verifies Fix 3: audit metadata records correct previous_status and new_status
    -- ==========================================================================
    PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_owner_id::text, true);
    PERFORM pg_catalog.set_config('sharewise.authorized_booking_transition', 'false', true);
    v_res := public.review_booking(v_booking_id, 'approve', 'Approved by lab manager');
    ASSERT (v_res->>'success')::boolean = true, 'Test 7 Failed: Owner approval should succeed';
    ASSERT (v_res->>'code') = 'OK', 'Test 7 Failed: Expected OK code';
    ASSERT (v_res->'data'->>'status') = 'approved', 'Test 7 Failed: Status should be approved';
    ASSERT pg_catalog.current_setting('sharewise.authorized_booking_transition', true) = 'true',
        'Test 7 Failed: review_booking did not set the authorization flag.';

    -- Verify audit metadata correctly captures previous and new status (Fix 3)
    SELECT
        metadata->>'previous_status',
        metadata->>'new_status'
    INTO v_prev_status, v_new_status
    FROM public.audit_events
    WHERE booking_id = v_booking_id
      AND event_type = 'booking_approved'
    ORDER BY created_at DESC
    LIMIT 1;
    ASSERT v_prev_status = 'pending',   'Test 7 Failed: Audit previous_status should be pending, got: ' || COALESCE(v_prev_status, 'NULL');
    ASSERT v_new_status  = 'approved',  'Test 7 Failed: Audit new_status should be approved, got: '    || COALESCE(v_new_status,  'NULL');
    RAISE NOTICE 'Test 7 Passed: Owner approved booking. Audit previous_status=pending, new_status=approved.';

    -- ======================================================================
    -- TEST 7A: Active block INSERT and UPDATE cannot overlap an active booking
    -- ======================================================================
    SELECT start_time, end_time
    INTO v_booking_start_time, v_booking_end_time
    FROM public.bookings
    WHERE id = v_booking_id;

    v_block_rejected := false;
    BEGIN
        INSERT INTO public.availability_blocks (
            resource_id, start_time, end_time, status, reason
        ) VALUES (
            v_resource_id, v_booking_start_time, v_booking_end_time,
            'active', 'Must be rejected by booking conflict guard'
        );
        RAISE EXCEPTION 'Expected overlapping active block INSERT to fail.'
            USING ERRCODE = 'P0001';
    EXCEPTION WHEN SQLSTATE '23P01' THEN
        v_block_rejected := true;
    END;
    ASSERT v_block_rejected, 'Test 7A Failed: overlapping active block INSERT was not rejected';

    INSERT INTO public.availability_blocks (
        resource_id, start_time, end_time, status, reason
    ) VALUES (
        v_resource_id, now() + interval '40 hours', now() + interval '41 hours',
        'cancelled', 'Fixture for active block UPDATE conflict test'
    ) RETURNING id INTO v_conflicting_block_id;

    v_block_rejected := false;
    BEGIN
        UPDATE public.availability_blocks
        SET start_time = v_booking_start_time,
            end_time = v_booking_end_time,
            status = 'active'
        WHERE id = v_conflicting_block_id;
        RAISE EXCEPTION 'Expected overlapping active block UPDATE to fail.'
            USING ERRCODE = 'P0001';
    EXCEPTION WHEN SQLSTATE '23P01' THEN
        v_block_rejected := true;
    END;
    ASSERT v_block_rejected, 'Test 7A Failed: activating/moving a block over a booking was not rejected';
    DELETE FROM public.availability_blocks WHERE id = v_conflicting_block_id;
    RAISE NOTICE 'Test 7A Passed: overlapping block INSERT and UPDATE rejected.';

    -- ==========================================================================
    -- TEST 7B: Approval rejected when active availability block overlaps (Fix 2)
    -- ==========================================================================
    -- Create a separate pending booking in a time window that has an active block
    PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_requester_id::text, true);

    -- Create a separate active block for the 20-22h approval test window.
    INSERT INTO public.availability_blocks (
        resource_id, start_time, end_time, status, reason
    ) VALUES (
        v_resource_id, now() + interval '20 hours', now() + interval '22 hours', 'active', 'Maintenance during approval test'
    );

    -- Directly insert a pending booking that overlaps the block (bypasses request_booking
    -- which would reject it at the request stage — we need to test review_booking separately)
    PERFORM pg_catalog.set_config('sharewise.authorized_booking_transition', 'true', true);
    BEGIN
        INSERT INTO public.bookings (
            resource_id, requester_id, start_time, end_time, purpose, status
        ) VALUES (
            v_resource_id, v_requester_id, now() + interval '20 hours 30 mins', now() + interval '21 hours 30 mins', 'Booking overlapping block', 'pending'
        ) RETURNING id INTO v_blocked_booking_id;

        PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_owner_id::text, true);
        v_res := public.review_booking(v_blocked_booking_id, 'approve', 'Trying to approve over active block');
        ASSERT (v_res->>'success')::boolean = false, 'Test 7B Failed: Approval over active availability block should fail';
        ASSERT (v_res->>'code') = 'RESOURCE_UNAVAILABLE', 'Test 7B Failed: Expected RESOURCE_UNAVAILABLE, got: ' || COALESCE(v_res->>'code', 'NULL');
        ASSERT v_res->>'data' IS NULL, 'Test 7B Failed: Data must be null on failure';
        RAISE NOTICE 'Test 7B Passed: Approval correctly rejected due to active availability block.';
    END;

    -- ==========================================================================
    -- TEST 7C: Approval rejected if resource enters maintenance after request
    -- ==========================================================================
    PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_requester_id::text, true);
    v_res := public.request_booking(
        v_resource_id,
        now() + interval '50 hours',
        now() + interval '51 hours',
        'Regression: resource maintenance after request'
    );
    ASSERT (v_res->>'success')::boolean = true,
        'Test 7C Failed: Initial booking request should succeed while resource is active';
    v_maintenance_booking_id := (v_res->'data'->>'id')::uuid;

    UPDATE public.resources SET status = 'maintenance' WHERE id = v_resource_id;
    PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_owner_id::text, true);
    v_res := public.review_booking(
        v_maintenance_booking_id, 'approve', 'Resource entered maintenance after request'
    );
    ASSERT (v_res->>'success')::boolean = false,
        'Test 7C Failed: Approval must fail when resource is in maintenance';
    ASSERT (v_res->>'code') = 'RESOURCE_UNAVAILABLE',
        'Test 7C Failed: Expected RESOURCE_UNAVAILABLE, got: ' || COALESCE(v_res->>'code', 'NULL');
    ASSERT v_res->>'data' IS NULL, 'Test 7C Failed: Data must be null on failure';
    ASSERT (SELECT status FROM public.bookings WHERE id = v_maintenance_booking_id) = 'pending',
        'Test 7C Failed: Booking status must remain pending';
    UPDATE public.resources SET status = 'active' WHERE id = v_resource_id;
    RAISE NOTICE 'Test 7C Passed: Approval rejected because resource entered maintenance after request.';

    -- ==========================================================================
    -- TEST 8: Check-in / Checkout transition and initial condition report
    -- ==========================================================================
    PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_requester_id::text, true);
    PERFORM pg_catalog.set_config('sharewise.authorized_booking_transition', 'false', true);
    v_res := public.check_in_booking(v_booking_id, 'Lenses clean, laser functional.');
    ASSERT (v_res->>'success')::boolean = true, 'Test 8 Failed: Check-in should succeed';
    ASSERT (v_res->>'code') = 'OK', 'Test 8 Failed: Expected OK code';
    ASSERT (v_res->'data'->>'status') = 'checked_out', 'Test 8 Failed: Status should be checked_out';
    ASSERT pg_catalog.current_setting('sharewise.authorized_booking_transition', true) = 'true',
        'Test 8 Failed: check_in_booking did not set the authorization flag.';

    -- Verify condition report was created
    SELECT count(*) INTO v_report_count
    FROM public.condition_reports
    WHERE booking_id = v_booking_id AND report_type = 'initial';
    ASSERT v_report_count = 1, 'Test 8 Failed: Initial condition report was not recorded';
    RAISE NOTICE 'Test 8 Passed: Check-in transition and condition report recorded.';

    -- ==========================================================================
    -- TEST 9: Return booking transition and final condition report
    -- ==========================================================================
    PERFORM pg_catalog.set_config('sharewise.authorized_booking_transition', 'false', true);
    v_res := public.return_booking(v_booking_id, 'Returned wiped down and power off.');
    ASSERT (v_res->>'success')::boolean = true, 'Test 9 Failed: Return should succeed';
    ASSERT (v_res->>'code') = 'OK', 'Test 9 Failed: Expected OK code';
    ASSERT (v_res->'data'->>'status') = 'returned', 'Test 9 Failed: Status should be returned';
    ASSERT pg_catalog.current_setting('sharewise.authorized_booking_transition', true) = 'true',
        'Test 9 Failed: return_booking did not set the authorization flag.';

    SELECT count(*) INTO v_report_count
    FROM public.condition_reports
    WHERE booking_id = v_booking_id AND report_type = 'final';
    ASSERT v_report_count = 1, 'Test 9 Failed: Final condition report was not recorded';
    RAISE NOTICE 'Test 9 Passed: Return transition and final condition report recorded.';

    -- ==========================================================================
    -- TEST 10: Invalid transition rejection (duplicate return)
    -- ==========================================================================
    v_res := public.return_booking(v_booking_id, 'Duplicate return attempt');
    ASSERT (v_res->>'success')::boolean = false, 'Test 10 Failed: Duplicate return should fail';
    ASSERT (v_res->>'code') = 'INVALID_STATUS_TRANSITION', 'Test 10 Failed: Expected INVALID_STATUS_TRANSITION';
    ASSERT v_res->>'data' IS NULL, 'Test 10 Failed: Data must be null on failure';
    RAISE NOTICE 'Test 10 Passed: Invalid status transition blocked.';

    -- ==========================================================================
    -- TEST 11: Dedicated cancellation by requester
    -- ==========================================================================
    -- Requester creates a fresh pending booking
    PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_requester_id::text, true);
    v_res := public.request_booking(v_resource_id, now() + interval '5 hours', now() + interval '6 hours', 'To be cancelled');
    v_booking_id := (v_res->'data'->>'id')::UUID;

    -- Requester cancels their own booking
    PERFORM pg_catalog.set_config('sharewise.authorized_booking_transition', 'false', true);
    v_cancel_res := public.cancel_booking(v_booking_id);
    ASSERT (v_cancel_res->>'success')::boolean = true, 'Test 11 Failed: Cancellation should succeed';
    ASSERT (v_cancel_res->>'code') = 'OK', 'Test 11 Failed: Expected OK code';
    ASSERT (v_cancel_res->'data'->>'status') = 'cancelled', 'Test 11 Failed: Status should be cancelled';
    ASSERT pg_catalog.current_setting('sharewise.authorized_booking_transition', true) = 'true',
        'Test 11 Failed: cancel_booking did not set the authorization flag.';
    RAISE NOTICE 'Test 11 Passed: Dedicated cancellation succeeded.';

    -- Verify transactional audit events exist
    SELECT count(*) INTO v_audit_count
    FROM public.audit_events
    WHERE booking_id = v_booking_id;
    ASSERT v_audit_count >= 2, 'Test 11 Failed: Audit trail incomplete for booking lifecycle';

    -- ==========================================================================
    -- TEST 12: Direct authenticated UPDATE of start_time/end_time is not exercised here
    -- ==========================================================================
    -- This suite runs inside a single DO block. PostgreSQL does not permit SET ROLE
    -- inside a function/DO block, so attempting the UPDATE here would run as the
    -- harness role and could produce a false pass. Verify this in a dedicated
    -- non-superuser session connected as authenticated, using a pending booking.
    RAISE NOTICE 'Test 12 NOT RUN: verify time-column UPDATE denial in a dedicated authenticated session.';

    -- ==========================================================================
    -- TEST 13: Duration just over max_booking_minutes is rejected (Fix 5)
    -- max_booking_minutes for Spectrometer A = 120. Test 121-minute booking.
    -- With round() this was incorrectly passing; with ceil() it is rejected.
    -- ==========================================================================
    PERFORM pg_catalog.set_config('request.jwt.claim.sub', v_requester_id::text, true);
    v_res := public.request_booking(
        v_resource_id,
        now() + interval '30 hours',
        now() + interval '30 hours' + interval '121 minutes',  -- exactly 1 minute over
        'Over-limit duration test'
    );
    ASSERT (v_res->>'success')::boolean = false, 'Test 13 Failed: 121-minute booking against 120-minute limit should fail';
    ASSERT (v_res->>'code') = 'INVALID_TIME_RANGE', 'Test 13 Failed: Expected INVALID_TIME_RANGE, got: ' || COALESCE(v_res->>'code', 'NULL');
    ASSERT v_res->>'data' IS NULL, 'Test 13 Failed: Data must be null on failure';
    RAISE NOTICE 'Test 13 Passed: 121-minute booking correctly rejected against 120-minute ceiling limit.';

    RAISE NOTICE '=============================================================';
    RAISE NOTICE 'Functional integration checks completed; Test 12 requires a dedicated authenticated session.';
    RAISE NOTICE '=============================================================';
END;
$$;

-- Always rollback so test records never persist in the test database
ROLLBACK;
