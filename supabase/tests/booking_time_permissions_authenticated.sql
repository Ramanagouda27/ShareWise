-- ShareWise booking time-column permission test.
-- Run ONLY against the isolated local sharewise_test_db database after
-- migrations 001-003 have been applied. This script is intended for psql.
-- Example from PowerShell at the workspace root:
--   Get-Content -Raw .\ShareWise\supabase\tests\booking_time_permissions_authenticated.sql |
--     docker exec -i sharewise-postgres-test psql -U sharewise_test -d sharewise_test_db -v ON_ERROR_STOP=1
-- The connection must be a privileged fixture/setup role that can SET ROLE
-- authenticated. Successful execution ends with ROLLBACK. With ON_ERROR_STOP,
-- any error exits psql with the transaction uncommitted; closing the connection
-- rolls it back.

\set ON_ERROR_STOP on

BEGIN;

-- Fixed identifiers make fixture ownership clear. Successful runs leave no
-- rows behind, so the test can be rerun. Refuse to reuse an occupied ID/email.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM auth.users
        WHERE id IN (
            '77777777-7777-4777-8777-777777777701'::uuid,
            '77777777-7777-4777-8777-777777777702'::uuid
        )
        OR email IN (
            'booking-time-permissions-owner@sharewise.test',
            'booking-time-permissions-requester@sharewise.test'
        )
    ) OR EXISTS (
        SELECT 1 FROM public.resources
        WHERE id = '77777777-7777-4777-8777-777777777703'::uuid
    ) OR EXISTS (
        SELECT 1 FROM public.bookings
        WHERE id = '77777777-7777-4777-8777-777777777704'::uuid
    ) THEN
        RAISE EXCEPTION 'Booking time permission test fixture ID or email already exists; refusing to reuse it.';
    END IF;
END;
$$;

-- auth.users insertion fires migration 001's trigger, which creates profiles.
INSERT INTO auth.users (id, email, created_at, updated_at, raw_user_meta_data, role, aud)
VALUES
    ('77777777-7777-4777-8777-777777777701'::uuid,
     'booking-time-permissions-owner@sharewise.test', now(), now(),
     '{"display_name":"Booking Time Test Owner"}'::jsonb, 'authenticated', 'authenticated'),
    ('77777777-7777-4777-8777-777777777702'::uuid,
     'booking-time-permissions-requester@sharewise.test', now(), now(),
     '{"display_name":"Booking Time Test Requester"}'::jsonb, 'authenticated', 'authenticated');

INSERT INTO public.resources (id, owner_id, name, category, location, status)
VALUES (
    '77777777-7777-4777-8777-777777777703'::uuid,
    '77777777-7777-4777-8777-777777777701'::uuid,
    'Booking time permission test resource', 'test', 'Local test database', 'active'
);

INSERT INTO public.bookings (id, resource_id, requester_id, start_time, end_time, purpose, status)
VALUES (
    '77777777-7777-4777-8777-777777777704'::uuid,
    '77777777-7777-4777-8777-777777777703'::uuid,
    '77777777-7777-4777-8777-777777777702'::uuid,
    now() + interval '2 days', now() + interval '2 days 1 hour',
    'Original permission test purpose', 'pending'
);

-- This must be a real effective database role. The JWT claim is set separately
-- because RLS policies use auth.uid(); it does not substitute for SET ROLE.
SELECT pg_catalog.set_config(
    'request.jwt.claim.sub', '77777777-7777-4777-8777-777777777702', true
);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_denied boolean;
    v_rows bigint;
BEGIN
    ASSERT current_user = 'authenticated',
        'Test must run with effective PostgreSQL role authenticated.';

    -- Verify the ACL itself. This differentiates a column privilege denial from
    -- an RLS policy that merely hides the target row (which gives UPDATE 0 rows).
    ASSERT NOT pg_catalog.has_column_privilege(
        current_user, 'public.bookings', 'start_time', 'UPDATE'
    ), 'authenticated unexpectedly has UPDATE privilege on bookings.start_time.';
    ASSERT NOT pg_catalog.has_column_privilege(
        current_user, 'public.bookings', 'end_time', 'UPDATE'
    ), 'authenticated unexpectedly has UPDATE privilege on bookings.end_time.';

    -- Each update must raise SQLSTATE 42501 (insufficient_privilege). If the row
    -- is merely filtered by RLS, the UPDATE succeeds with zero affected rows and
    -- this assertion block fails with the sentinel exception instead.
    v_denied := false;
    BEGIN
        UPDATE public.bookings
        SET start_time = start_time + interval '1 minute'
        WHERE id = '77777777-7777-4777-8777-777777777704'::uuid;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        RAISE EXCEPTION 'Expected start_time privilege denial; UPDATE affected % rows.', v_rows
            USING ERRCODE = 'P0001';
    EXCEPTION WHEN SQLSTATE '42501' THEN
        v_denied := true;
    END;
    ASSERT v_denied, 'Direct UPDATE of bookings.start_time was not privilege-denied.';

    v_denied := false;
    BEGIN
        UPDATE public.bookings
        SET end_time = end_time + interval '1 minute'
        WHERE id = '77777777-7777-4777-8777-777777777704'::uuid;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        RAISE EXCEPTION 'Expected end_time privilege denial; UPDATE affected % rows.', v_rows
            USING ERRCODE = 'P0001';
    EXCEPTION WHEN SQLSTATE '42501' THEN
        v_denied := true;
    END;
    ASSERT v_denied, 'Direct UPDATE of bookings.end_time was not privilege-denied.';

    -- Condition reports are written only by lifecycle RPCs so clients cannot
    -- bypass checkout/return sequencing or create duplicate initial/final reports.
    ASSERT NOT pg_catalog.has_table_privilege(
        current_user, 'public.condition_reports', 'INSERT'
    ), 'authenticated unexpectedly has direct INSERT privilege on condition_reports.';

    ASSERT NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'condition_reports'
          AND cmd IN ('INSERT', 'ALL')
    ), 'An INSERT-capable RLS policy unexpectedly exists on condition_reports.';

    -- The fixture booking and requester profile above are valid targets. The
    -- ACL and policy assertions establish why this must fail; the attempted
    -- INSERT must raise 42501, never silently affect zero rows or succeed.
    v_denied := false;
    BEGIN
        INSERT INTO public.condition_reports (
            booking_id, reporter_id, report_type, notes
        ) VALUES (
            '77777777-7777-4777-8777-777777777704'::uuid,
            '77777777-7777-4777-8777-777777777702'::uuid,
            'initial', 'Direct authenticated INSERT must be denied'
        );
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        RAISE EXCEPTION 'Expected condition_reports INSERT privilege denial; INSERT affected % rows.', v_rows
            USING ERRCODE = 'P0001';
    EXCEPTION WHEN SQLSTATE '42501' THEN
        v_denied := true;
    END;
    ASSERT v_denied,
        'Direct INSERT of public.condition_reports was not privilege-denied.';

    -- RLS control: authenticated may update the granted purpose column on their
    -- own pending booking, while the resource owner (who is not the requester)
    -- can see the booking but cannot update it under the requester-only policy.
    UPDATE public.bookings
    SET purpose = 'Own-row RLS permission verified'
    WHERE id = '77777777-7777-4777-8777-777777777704'::uuid;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    ASSERT v_rows = 1, 'RLS should allow the requester to update own pending booking purpose.';

    PERFORM pg_catalog.set_config(
        'request.jwt.claim.sub', '77777777-7777-4777-8777-777777777701', true
    );
    UPDATE public.bookings
    SET purpose = 'This must not change'
    WHERE id = '77777777-7777-4777-8777-777777777704'::uuid;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    ASSERT v_rows = 0, 'RLS should filter this booking from the resource owner UPDATE.';

    RAISE NOTICE 'PASS: authenticated direct INSERT into condition_reports and UPDATE of booking start_time/end_time were privilege-denied; RLS own/other-row controls also behaved as expected.';
END;
$$;

RESET ROLE;
ROLLBACK;
