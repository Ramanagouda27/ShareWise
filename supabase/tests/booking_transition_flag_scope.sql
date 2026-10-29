-- Verify transaction-local lifecycle authorization flag scope.
-- Run in ONE psql process/session against an isolated local disposable database.
-- This script changes no application tables and resets its session-level baseline.

\set ON_ERROR_STOP on

SELECT pg_catalog.set_config('sharewise.authorized_booking_transition', 'false', false);

BEGIN;
SELECT pg_catalog.set_config('sharewise.authorized_booking_transition', 'true', true);
DO $$
BEGIN
    IF pg_catalog.current_setting('sharewise.authorized_booking_transition', true)
       IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION 'Flag-scope test failed: local value was not true before COMMIT.';
    END IF;
END;
$$;
COMMIT;

DO $$
BEGIN
    IF pg_catalog.current_setting('sharewise.authorized_booking_transition', true)
       IS DISTINCT FROM 'false' THEN
        RAISE EXCEPTION 'Flag-scope test failed: COMMIT did not restore the session baseline.';
    END IF;
END;
$$;

BEGIN;
SELECT pg_catalog.set_config('sharewise.authorized_booking_transition', 'true', true);
DO $$
BEGIN
    IF pg_catalog.current_setting('sharewise.authorized_booking_transition', true)
       IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION 'Flag-scope test failed: local value was not true before ROLLBACK.';
    END IF;
END;
$$;
ROLLBACK;

DO $$
BEGIN
    IF pg_catalog.current_setting('sharewise.authorized_booking_transition', true)
       IS DISTINCT FROM 'false' THEN
        RAISE EXCEPTION 'Flag-scope test failed: ROLLBACK did not restore the session baseline.';
    END IF;
END;
$$;

RESET sharewise.authorized_booking_transition;
\echo PASS: transaction-local authorization flag reverted to session false after COMMIT and ROLLBACK.
