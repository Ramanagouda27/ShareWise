-- ShareWise local two-session concurrency protocol.
-- Run ONLY against the isolated local sharewise_test_db database after
-- migrations 001-003 are applied. Never run against shared Supabase.
--
-- This file's executable setup commits deterministic test fixtures. The race
-- scenarios below are comments because each requires manually interleaving two
-- independent psql sessions. Successful scenario effects persist until the
-- guarded cleanup instructions at the end are run.
--
-- Start two terminals with:
--   docker exec -it sharewise-postgres-test psql -U sharewise_test -d sharewise_test_db
-- Run this file once in either session for setup (or pipe it through psql with
-- ON_ERROR_STOP). Do not rerun setup while fixture rows exist; it refuses ID or
-- marker collisions rather than deleting data.

\set ON_ERROR_STOP on

BEGIN;

-- Test identities and deterministic fixture object IDs.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM auth.users
        WHERE id IN (
            '11111111-1111-1111-1111-111111111111'::uuid,
            '22222222-2222-2222-2222-222222222222'::uuid,
            '33333333-3333-3333-3333-333333333333'::uuid
        ) OR email IN ('owner@sharewise.test', 'alice@sharewise.test', 'bob@sharewise.test')
    ) OR EXISTS (
        SELECT 1 FROM public.resources
        WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
    ) OR EXISTS (
        SELECT 1 FROM public.bookings
        WHERE id IN (
            'bbbbbbbb-1111-1111-1111-111111111111'::uuid,
            'bbbbbbbb-2222-2222-2222-222222222222'::uuid
        ) OR (resource_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
              AND purpose = 'Requester 1 Overlap Test')
    ) OR EXISTS (
        SELECT 1 FROM public.availability_blocks
        WHERE id IN (
            'cccccccc-1111-4111-8111-111111111111'::uuid,
            'cccccccc-2222-4222-8222-222222222222'::uuid
        )
    ) THEN
        RAISE EXCEPTION 'Concurrency test fixtures already exist. Run the guarded cleanup section first or recreate the disposable local database.';
    END IF;
END;
$$;

-- auth.users inserts fire migration 001's trigger, which creates profiles.
-- Do not separately insert profiles: that would duplicate the trigger-created rows.
INSERT INTO auth.users (id, email, created_at, updated_at, raw_user_meta_data, role, aud)
VALUES
    ('11111111-1111-1111-1111-111111111111'::uuid, 'owner@sharewise.test', now(), now(),
     '{"display_name":"Lab Manager (Owner)"}'::jsonb, 'authenticated', 'authenticated'),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'alice@sharewise.test', now(), now(),
     '{"display_name":"Alice (Requester 1)"}'::jsonb, 'authenticated', 'authenticated'),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'bob@sharewise.test', now(), now(),
     '{"display_name":"Bob (Requester 2)"}'::jsonb, 'authenticated', 'authenticated');

INSERT INTO public.resources (
    id, owner_id, name, description, category, location, status, max_booking_minutes
) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    'ShareWise concurrency test resource',
    'Deterministic local-only test fixture',
    'fabrication', 'Local test room', 'active', 240
);

-- Two overlapping pending rows support the concurrent approval race.
INSERT INTO public.bookings (
    id, resource_id, requester_id, start_time, end_time, purpose, status
)
VALUES
    ('bbbbbbbb-1111-1111-1111-111111111111'::uuid,
     'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
     '22222222-2222-2222-2222-222222222222'::uuid,
     now() + interval '10 hours', now() + interval '12 hours', 'Pending Slot 1', 'pending'),
    ('bbbbbbbb-2222-2222-2222-222222222222'::uuid,
     'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
     '33333333-3333-3333-3333-333333333333'::uuid,
     now() + interval '11 hours', now() + interval '13 hours', 'Pending Slot 2', 'pending');

COMMIT;

-- ============================================================================
-- SCENARIO 1: Concurrent overlapping booking requests
-- Expected: Alice succeeds; Bob waits on the parent resource lock, then returns
-- BOOKING_CONFLICT after Alice commits.
-- ============================================================================
-- SESSION A:
-- BEGIN ISOLATION LEVEL READ COMMITTED;
-- SET LOCAL lock_timeout = '60s';
-- SET LOCAL statement_timeout = '2min';
-- SET request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
-- SELECT public.request_booking('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
--     now() + interval '2 hours', now() + interval '4 hours', 'Requester 1 Overlap Test');
-- Leave the transaction open after success.
--
-- SESSION B (while A remains open):
-- BEGIN ISOLATION LEVEL READ COMMITTED;
-- SET LOCAL lock_timeout = '60s';
-- SET LOCAL statement_timeout = '2min';
-- SET request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
-- SELECT public.request_booking('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
--     now() + interval '3 hours', now() + interval '5 hours', 'Requester 2 Overlap Test');
-- This call should wait. Switch to A and COMMIT; B should return BOOKING_CONFLICT.
-- Then ROLLBACK in B. Alice's booking and its audit event persist.

-- ============================================================================
-- SCENARIO 2: Concurrent approvals of overlapping pending bookings
-- Expected: first approval succeeds; second waits, then returns BOOKING_CONFLICT.
-- ============================================================================
-- SESSION A:
-- BEGIN ISOLATION LEVEL READ COMMITTED;
-- SET LOCAL lock_timeout = '60s';
-- SET LOCAL statement_timeout = '2min';
-- SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
-- SELECT public.review_booking('bbbbbbbb-1111-1111-1111-111111111111'::uuid,
--     'approve', 'Approved Slot 1');
-- Leave open. SESSION B uses the same owner claim to run:
-- BEGIN ISOLATION LEVEL READ COMMITTED;
-- SET LOCAL lock_timeout = '60s';
-- SET LOCAL statement_timeout = '2min';
-- SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
-- SELECT public.review_booking('bbbbbbbb-2222-2222-2222-222222222222'::uuid,
--     'approve', 'Approved Slot 2');
-- B should wait. COMMIT A; B should return BOOKING_CONFLICT, then ROLLBACK B.
-- Booking 1's approved status and audit event persist; booking 2 remains pending.

-- ============================================================================
-- SCENARIO 3A: Booking wins; concurrent active block INSERT is rejected
-- This proves the block trigger waits for the same parent resource lock and
-- rechecks bookings after the winner commits.
-- ============================================================================
-- SESSION A:
-- BEGIN ISOLATION LEVEL READ COMMITTED;
-- SET LOCAL lock_timeout = '60s';
-- SET LOCAL statement_timeout = '2min';
-- SET request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
-- SELECT public.request_booking('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
--     now() + interval '30 hours', now() + interval '32 hours', 'Block Race Booking Winner');
-- Leave open after success. SESSION B, while A remains open:
-- BEGIN ISOLATION LEVEL READ COMMITTED;
-- SET LOCAL lock_timeout = '60s';
-- SET LOCAL statement_timeout = '2min';
-- DO $$ BEGIN
--     BEGIN
--         INSERT INTO public.availability_blocks
--             (id, resource_id, start_time, end_time, status, reason)
--         VALUES ('cccccccc-1111-4111-8111-111111111111'::uuid,
--             'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
--             now() + interval '30 hours', now() + interval '32 hours',
--             'active', 'Concurrent block race; expected rejection');
--         RAISE EXCEPTION 'Expected block conflict was not raised.' USING ERRCODE = 'P0001';
--     EXCEPTION WHEN SQLSTATE '23P01' THEN
--         RAISE NOTICE 'PASS: block INSERT rejected after booking commit.';
--     END;
-- END $$;
-- The DO call waits on A's resource lock. COMMIT A while B waits. B should then
-- print PASS and remain committable; ROLLBACK B. The booking and audit persist;
-- the rejected block does not.

-- ============================================================================
-- SCENARIO 3B: Block wins; concurrent booking returns RESOURCE_UNAVAILABLE
-- ============================================================================
-- SESSION B:
-- BEGIN ISOLATION LEVEL READ COMMITTED;
-- SET LOCAL lock_timeout = '60s';
-- SET LOCAL statement_timeout = '2min';
-- INSERT INTO public.availability_blocks
--     (id, resource_id, start_time, end_time, status, reason)
-- VALUES ('cccccccc-2222-4222-8222-222222222222'::uuid,
--     'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
--     now() + interval '40 hours', now() + interval '42 hours',
--     'active', 'Concurrent block wins race');
-- Leave uncommitted. SESSION A, while B remains open:
-- BEGIN ISOLATION LEVEL READ COMMITTED;
-- SET LOCAL lock_timeout = '60s';
-- SET LOCAL statement_timeout = '2min';
-- SET request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
-- SELECT public.request_booking('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
--     now() + interval '40 hours', now() + interval '42 hours', 'Block Race Booking Loser');
-- A should wait. COMMIT B; A should return success=false, code=RESOURCE_UNAVAILABLE.
-- ROLLBACK A. The active block persists; the rejected booking and audit do not.

-- ============================================================================
-- SAFE CLEANUP (run manually only after both sessions are idle)
-- The guard verifies the exact fixture identities before deleting dependencies.
-- All committed scenario bookings are identified by the fixture resource and
-- exact scenario purpose / deterministic IDs. No cleanup runs automatically.
-- ============================================================================
-- BEGIN;
-- DO $$ BEGIN
--     IF EXISTS (SELECT 1 FROM auth.users WHERE id = '11111111-1111-1111-1111-111111111111'::uuid AND email <> 'owner@sharewise.test')
--        OR EXISTS (SELECT 1 FROM auth.users WHERE id = '22222222-2222-2222-2222-222222222222'::uuid AND email <> 'alice@sharewise.test')
--        OR EXISTS (SELECT 1 FROM auth.users WHERE id = '33333333-3333-3333-3333-333333333333'::uuid AND email <> 'bob@sharewise.test')
--        OR EXISTS (SELECT 1 FROM auth.users WHERE email = 'owner@sharewise.test' AND id <> '11111111-1111-1111-1111-111111111111'::uuid)
--        OR EXISTS (SELECT 1 FROM auth.users WHERE email = 'alice@sharewise.test' AND id <> '22222222-2222-2222-2222-222222222222'::uuid)
--        OR EXISTS (SELECT 1 FROM auth.users WHERE email = 'bob@sharewise.test' AND id <> '33333333-3333-3333-3333-333333333333'::uuid)
--        OR EXISTS (SELECT 1 FROM public.resources WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
--                   AND (name <> 'ShareWise concurrency test resource'
--                        OR owner_id <> '11111111-1111-1111-1111-111111111111'::uuid)) THEN
--         RAISE EXCEPTION 'Fixture identity mismatch; refusing cleanup.';
--     END IF;
--     IF EXISTS (SELECT 1 FROM public.bookings WHERE id = 'bbbbbbbb-1111-1111-1111-111111111111'::uuid
--                AND (resource_id <> 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid OR purpose <> 'Pending Slot 1'))
--        OR EXISTS (SELECT 1 FROM public.bookings WHERE id = 'bbbbbbbb-2222-2222-2222-222222222222'::uuid
--                   AND (resource_id <> 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid OR purpose <> 'Pending Slot 2'))
--        OR EXISTS (SELECT 1 FROM public.availability_blocks WHERE id = 'cccccccc-1111-4111-8111-111111111111'::uuid
--                   AND resource_id <> 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid)
--        OR EXISTS (SELECT 1 FROM public.availability_blocks WHERE id = 'cccccccc-2222-4222-8222-222222222222'::uuid
--                   AND resource_id <> 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid) THEN
--         RAISE EXCEPTION 'Fixture child identity mismatch; refusing cleanup.';
--     END IF;
-- END $$;
-- DELETE FROM public.incidents
-- WHERE booking_id IN (
--     SELECT id
--     FROM public.bookings
--     WHERE resource_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
--       AND (
--           id IN ('bbbbbbbb-1111-1111-1111-111111111111'::uuid,
--                  'bbbbbbbb-2222-2222-2222-222222222222'::uuid)
--           OR (purpose = 'Requester 1 Overlap Test' AND requester_id = '22222222-2222-2222-2222-222222222222'::uuid)
--           OR (purpose = 'Requester 2 Overlap Test' AND requester_id = '33333333-3333-3333-3333-333333333333'::uuid)
--           OR (purpose = 'Block Race Booking Winner' AND requester_id = '22222222-2222-2222-2222-222222222222'::uuid)
--           OR (purpose = 'Block Race Booking Loser' AND requester_id = '33333333-3333-3333-3333-333333333333'::uuid)
--       )
-- );
-- DELETE FROM public.condition_reports
-- WHERE booking_id IN (
--     SELECT id
--     FROM public.bookings
--     WHERE resource_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
--       AND (
--           id IN ('bbbbbbbb-1111-1111-1111-111111111111'::uuid,
--                  'bbbbbbbb-2222-2222-2222-222222222222'::uuid)
--           OR (purpose = 'Requester 1 Overlap Test' AND requester_id = '22222222-2222-2222-2222-222222222222'::uuid)
--           OR (purpose = 'Requester 2 Overlap Test' AND requester_id = '33333333-3333-3333-3333-333333333333'::uuid)
--           OR (purpose = 'Block Race Booking Winner' AND requester_id = '22222222-2222-2222-2222-222222222222'::uuid)
--           OR (purpose = 'Block Race Booking Loser' AND requester_id = '33333333-3333-3333-3333-333333333333'::uuid)
--       )
-- );
-- This protocol does not create eligibility records, so cleanup intentionally
-- does not delete any eligibility_records.
-- DELETE FROM public.audit_events AS ae
-- USING public.bookings AS b
-- WHERE ae.resource_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
--   AND ae.booking_id = b.id
--   AND b.resource_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
--   AND (
--       b.id IN ('bbbbbbbb-1111-1111-1111-111111111111'::uuid,
--                'bbbbbbbb-2222-2222-2222-222222222222'::uuid)
--       OR (b.purpose = 'Requester 1 Overlap Test' AND b.requester_id = '22222222-2222-2222-2222-222222222222'::uuid)
--       OR (b.purpose = 'Requester 2 Overlap Test' AND b.requester_id = '33333333-3333-3333-3333-333333333333'::uuid)
--       OR (b.purpose = 'Block Race Booking Winner' AND b.requester_id = '22222222-2222-2222-2222-222222222222'::uuid)
--       OR (b.purpose = 'Block Race Booking Loser' AND b.requester_id = '33333333-3333-3333-3333-333333333333'::uuid)
--   )
--   AND (
--       (ae.event_type = 'booking_requested'
--        AND ae.actor_id = b.requester_id
--        AND ae.reason = 'User submitted new booking request')
--       OR (ae.event_type = 'booking_approved'
--           AND b.id = 'bbbbbbbb-1111-1111-1111-111111111111'::uuid
--           AND ae.actor_id = '11111111-1111-1111-1111-111111111111'::uuid
--           AND ae.reason = 'Approved Slot 1')
--   );
-- DELETE FROM public.bookings
-- WHERE resource_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
--   AND (id IN ('bbbbbbbb-1111-1111-1111-111111111111'::uuid,
--               'bbbbbbbb-2222-2222-2222-222222222222'::uuid)
--        OR (purpose = 'Requester 1 Overlap Test' AND requester_id = '22222222-2222-2222-2222-222222222222'::uuid)
--        OR (purpose = 'Requester 2 Overlap Test' AND requester_id = '33333333-3333-3333-3333-333333333333'::uuid)
--        OR (purpose = 'Block Race Booking Winner' AND requester_id = '22222222-2222-2222-2222-222222222222'::uuid)
--        OR (purpose = 'Block Race Booking Loser' AND requester_id = '33333333-3333-3333-3333-333333333333'::uuid));
-- DELETE FROM public.availability_blocks
-- WHERE id IN ('cccccccc-1111-4111-8111-111111111111'::uuid,
--              'cccccccc-2222-4222-8222-222222222222'::uuid)
--   AND resource_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
-- DELETE FROM public.resources
-- WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
--   AND name = 'ShareWise concurrency test resource'
--   AND owner_id = '11111111-1111-1111-1111-111111111111'::uuid;
-- DELETE FROM auth.users
-- WHERE (id, email) IN (
--     ('11111111-1111-1111-1111-111111111111'::uuid, 'owner@sharewise.test'),
--     ('22222222-2222-2222-2222-222222222222'::uuid, 'alice@sharewise.test'),
--     ('33333333-3333-3333-3333-333333333333'::uuid, 'bob@sharewise.test')
-- );
-- COMMIT;
-- If cleanup raises an error, issue ROLLBACK and inspect remaining dependencies.
