# ShareWise Database Integration Audit

**Audit date:** 2026-10-29
**Database scope:** Local Docker PostgreSQL only. The existing `sharewise_test_db` was not modified, reset, cleaned, or used for committing test setup. All new setup and concurrency scenarios ran in the separate disposable database `sharewise_concurrency_test_db`. No shared Supabase connection or deployment was made.

## Environment and setup

- Container: `sharewise-postgres-test`; PostgreSQL 16.15; Docker login: `sharewise_test` (`postgres` login does not exist).
- A read-only privilege check confirmed `sharewise_test` is a superuser and has database creation rights. `sharewise_concurrency_test_db` did not exist before this run.
- Created that database, then applied `supabase/tests/local_test_bootstrap.sql` and migrations `202610280001_profiles.sql`, `202610280002_sharewise_core_tables.sql`, and `202610280003_booking_rpcs.sql`, in order. Each command exited successfully with `ON_ERROR_STOP=1`.
- Ran `concurrent_booking_tests.sql` setup once in the disposable database. Its collision guard completed and setup committed 3 auth users (with trigger-created profiles), 1 resource, and 2 pending bookings.
- Reviewed migration SQL before execution. The migrations had no `DROP TABLE`, `TRUNCATE`, or `DELETE` statements. No pre-existing database was targeted by these setup commands.

## Results

| Check | Result | Evidence |
|---|---|---|
| Functional RPC suite | **Passed with one skipped check** | Corrected suite run in `sharewise_predeploy_verify_20261029_1_db` reported Tests 1–11, 7A–7C, and 13 as `Passed`; Test 12 was explicitly `NOT RUN`; script reached `ROLLBACK`. |
| Authenticated permissions | **Passed** | Corrected suite run in `sharewise_predeploy_verify_20261029_1_db` reported direct condition-report INSERT and booking-time UPDATE privilege denials, checked the INSERT policy/ACL and RLS cases, then reset role and rolled back. |
| Concurrent booking requests | **Passed** | In two separate psql sessions, Alice's request returned `success=true`, `code=OK`; overlapping Bob request waited for Alice's commit then returned `success=false`, `code=BOOKING_CONFLICT`. Bob's transaction was rolled back. |
| Concurrent booking approvals | **Passed** | Owner's approval of deterministic booking 1 returned `OK`; concurrent approval of booking 2 waited for the first commit and returned `BOOKING_CONFLICT`. The second transaction was rolled back. |
| Booking wins vs active block insert | **Passed** | Alice's booking request returned `OK`; concurrent block insert waited and the documented exception handler reported `PASS: block INSERT rejected after booking commit.` The block transaction was rolled back. |
| Active block wins vs booking request | **Passed** | The block insert committed; concurrent booking request returned `success=false`, `code=RESOURCE_UNAVAILABLE`. The booking transaction was rolled back. |
| Guarded concurrency fixture cleanup | **Passed** | The exact cleanup block from the test file committed. Subsequent read-only counts were zero for fixture `auth.users`, profiles, resource, bookings, availability blocks, incidents, eligibility records, condition reports, and audit events. |
| Disposable database lifecycle | **Verified / retained** | `sharewise_concurrency_test_db` still exists after cleanup. It was not dropped. |
| Shared Supabase | **Unverified / not accessed** | No shared Supabase connection, query, or deployment occurred. |

The four documented concurrency interleavings ran with separate simultaneous psql sessions against the disposable database at `READ COMMITTED`, with the file's 60-second lock timeout and 2-minute statement timeout. Setup rows were committed as required by the protocol. Successful scenario effects were then removed by the guarded cleanup. The existing `sharewise_test_db` and its colliding fixtures remain untouched.

No executed scenario failed. Test 12 of the functional suite was skipped as documented above. Shared Supabase state remains unverified because it was not accessed.

## Commands and protocol used

Database creation and local bootstrap/migration application were scoped to the new database:

```powershell
docker exec sharewise-postgres-test createdb -U sharewise_test sharewise_concurrency_test_db
Get-Content -Raw .\supabase\tests\local_test_bootstrap.sql | docker exec -i sharewise-postgres-test psql -X -U sharewise_test -d sharewise_concurrency_test_db -v ON_ERROR_STOP=1
Get-Content -Raw .\supabase\migrations\202610280001_profiles.sql | docker exec -i sharewise-postgres-test psql -X -U sharewise_test -d sharewise_concurrency_test_db -v ON_ERROR_STOP=1
Get-Content -Raw .\supabase\migrations\202610280002_sharewise_core_tables.sql | docker exec -i sharewise-postgres-test psql -X -U sharewise_test -d sharewise_concurrency_test_db -v ON_ERROR_STOP=1
Get-Content -Raw .\supabase\migrations\202610280003_booking_rpcs.sql | docker exec -i sharewise-postgres-test psql -X -U sharewise_test -d sharewise_concurrency_test_db -v ON_ERROR_STOP=1
Get-Content -Raw .\supabase\tests\concurrent_booking_tests.sql | docker exec -i sharewise-postgres-test psql -X -U sharewise_test -d sharewise_concurrency_test_db -v ON_ERROR_STOP=1
```

Two independent terminals were opened with:

```powershell
docker exec -it sharewise-postgres-test psql -X -U sharewise_test -d sharewise_concurrency_test_db
```

Each session followed the corresponding Session A / Session B commands and commit/rollback order in `supabase/tests/concurrent_booking_tests.sql`. After both sessions were idle, its commented guarded cleanup transaction was extracted verbatim and run in the same disposable database. Read-only count checks confirmed cleanup; the disposable DB was retained for owner review.

Prior functional/permission suite commands against the already-existing local `sharewise_test_db` are recorded above as historical audit evidence. No test setup, cleanup, migration, or write statement was run against that database during this concurrency run.

## Handoff ZIP

`sharewise_member3_handoff_final.zip` is intended to contain the README, integration contract, this audit, all three migrations, and the four SQL test/bootstrap files. The archive was refreshed after recording the actual concurrency results; entry-by-entry source hash verification is recorded after the rebuild.

## Limitations and owner next steps

- The functional suite's Test 12 remains skipped in that suite; the separate authenticated permission test covers direct `start_time` and `end_time` update denial.
- No shared Supabase state was inspected, and no production deployment readiness is asserted.
- Review the audit and refreshed ZIP. The local disposable database `sharewise_concurrency_test_db` remains available and fixture-clean; the owner may drop it later if desired. Do not use or clean the colliding fixtures in `sharewise_test_db` without a separate explicit review.
- Any shared Supabase migration/deployment is a separate operation and was not part of this audit.


## Reviewer follow-up (2026-10-29)

- **Approval-time resource status:** `review_booking` now checks `v_resource.status = 'active'` under the already-held resource row lock before approving. If the resource is `maintenance` or `inactive`, it returns `RESOURCE_UNAVAILABLE` and does not transition the booking. Regression Test 7C creates a pending request, changes the resource to `maintenance`, and asserts approval is rejected. The revised test passed in the final disposable-database run below.
- **Concurrency documentation reconciled:** the README and integration contract now reflect the recorded four-scenario pass in `sharewise_concurrency_test_db`, including guarded cleanup. The functional suite's historical run is distinguished from the newly added regression test. The functional test header no longer incorrectly says the entire suite was never executed.
- **Condition reports:** authenticated direct `INSERT` has been removed from the grant and policy; lifecycle RPCs remain responsible for initial/final reports. The authenticated permission suite's ACL assertion and a separate direct INSERT probe both passed in the final disposable-database run below.
- **Owner authorization model:** self-service resource creation is explicitly documented as an MVP decision. RLS binds `owner_id` to `auth.uid()`; no separate role or approval model exists.
- **Safety:** that earlier package revision was prepared from the uploaded ZIP only. The final verification below used a newly created disposable local database; existing local databases and shared Supabase were not modified or accessed.

## Final regression verification (2026-10-29)

### Why Test 7C failed on the earlier database

The revised migration file contains the approval-time check inside `review_booking`: while holding the resource row lock, an approval returns `RESOURCE_UNAVAILABLE` when `v_resource.status IS DISTINCT FROM 'active'`. A read-only inspection found that the function already installed in `sharewise_concurrency_test_db` did not contain this check. Editing a migration file does not update a database where that migration was previously applied; the installed function was from the earlier migration definition. That existing database was preserved. To verify the revised source without resetting it, the bootstrap and migrations were applied in order to the new `sharewise_handoff_verify_db` database.

### Commands and actual results

The following commands targeted only `sharewise_handoff_verify_db`; each bootstrap/migration psql command exited 0 with `ON_ERROR_STOP=1`:

```powershell
docker exec sharewise-postgres-test createdb -U sharewise_test sharewise_handoff_verify_db
Get-Content -Raw .\supabase\tests\local_test_bootstrap.sql | docker exec -i sharewise-postgres-test psql -X -U sharewise_test -d sharewise_handoff_verify_db -v ON_ERROR_STOP=1
Get-Content -Raw .\supabase\migrations\202610280001_profiles.sql | docker exec -i sharewise-postgres-test psql -X -U sharewise_test -d sharewise_handoff_verify_db -v ON_ERROR_STOP=1
Get-Content -Raw .\supabase\migrations\202610280002_sharewise_core_tables.sql | docker exec -i sharewise-postgres-test psql -X -U sharewise_test -d sharewise_handoff_verify_db -v ON_ERROR_STOP=1
Get-Content -Raw .\supabase\migrations\202610280003_booking_rpcs.sql | docker exec -i sharewise-postgres-test psql -X -U sharewise_test -d sharewise_handoff_verify_db -v ON_ERROR_STOP=1
Get-Content -Raw .\supabase\tests\booking_rpcs_test.sql | docker exec -i sharewise-postgres-test psql -X -U sharewise_test -d sharewise_handoff_verify_db -v ON_ERROR_STOP=1
Get-Content -Raw .\supabase\tests\booking_time_permissions_authenticated.sql | docker exec -i sharewise-postgres-test psql -X -U sharewise_test -d sharewise_handoff_verify_db -v ON_ERROR_STOP=1
```

Observed psql output for the revised functional suite included `Test 7C Passed: Approval rejected because resource entered maintenance after request.`, Passed notices for Tests 1–11, 7A, 7B, and 13, the expected `Test 12 NOT RUN` notice, then `DO` and `ROLLBACK`; exit status was 0. No test failure notice occurred.

In the preceding run, the then-current authenticated permission script emitted `PASS: authenticated lacks UPDATE privileges on start_time and end_time; RLS own/other-row controls also behaved as expected.`, followed by `RESET` and `ROLLBACK`; exit status was 0. That revision asserted there was no table INSERT privilege on `condition_reports` but did not attempt an INSERT, so a separate fixture-guarded transaction attempted one as the actual `authenticated` role and reported SQLSTATE `42501`. The permission script was subsequently updated to include the policy check and direct INSERT attempt; its corrected run is recorded below.

A final read-only query returned `maintenance_guard_installed = true` for the installed function in `sharewise_handoff_verify_db`. Fixture counts for the permission probe's two auth users, resource, booking, and condition report were all 0 after rollback. The new verification database was retained. `sharewise_test_db` and the earlier `sharewise_concurrency_test_db` were not modified or reset; shared Supabase was not accessed.

### Final result classification

- **Passed:** bootstrap and migrations 001–003 in the new disposable database; functional RPC suite including Test 7C; authenticated time-column permission suite; direct condition-report INSERT denial probe; fixture rollback verification.
- **Skipped:** Test 12 within the functional suite, by design; the dedicated authenticated session test covers its time-column permission check.
- **Failed:** none in the final fresh-database run. The reported earlier Test 7C failure was on a database with the old installed function definition.
- **Unverified / not accessed:** shared Supabase and production deployment behavior.

## Corrected permission-test verification (2026-10-29)

The local database inventory showed `sharewise_concurrency_test_db`, `sharewise_handoff_verify_corrected_db`, `sharewise_handoff_verify_db`, and `sharewise_test_db`. These were preserved. The local role had database creation permission. A new database, `sharewise_predeploy_verify_20261029_1_db`, was created; the bootstrap and migrations 001–003 were applied there in order. Each psql invocation used `ON_ERROR_STOP=1` and exited 0. Neither concurrency test was rerun.

The corrected functional suite was run with:

```powershell
Get-Content -Raw .\supabase\tests\booking_rpcs_test.sql | docker exec -i sharewise-postgres-test psql -X -U sharewise_test -d sharewise_predeploy_verify_20261029_1_db -v ON_ERROR_STOP=1
```

Observed output included `Test 7C Passed: Approval rejected because resource entered maintenance after request.`, Passed notices for Tests 1–11, 7A, 7B, and 13, `Test 12 NOT RUN`, and final `DO` / `ROLLBACK`. Exit status: **0**.

The corrected authenticated permission suite was run with:

```powershell
Get-Content -Raw .\supabase\tests\booking_time_permissions_authenticated.sql | docker exec -i sharewise-postgres-test psql -X -U sharewise_test -d sharewise_predeploy_verify_20261029_1_db -v ON_ERROR_STOP=1
```

Observed output included `SET`, `DO`, and `PASS: authenticated direct INSERT into condition_reports and UPDATE of booking start_time/end_time were privilege-denied; RLS own/other-row controls also behaved as expected.`, then `RESET` and `ROLLBACK`. Exit status: **0**. The script checks that `authenticated` has no table INSERT privilege, that no INSERT/ALL RLS policy exists on `condition_reports`, and that the direct fixture-backed INSERT raises `42501`; successful insertion or a non-42501 error fails the block. Fixture writes and the attempted insert were rolled back.

The final ZIP was refreshed after this update and the corrected test pass. Concurrency outcomes remain recorded in the earlier audit section as summaries only; raw two-session transcripts are not saved. The existing concurrency database and its fixture state were not touched during this correction. Shared Supabase was not accessed or deployed to.

## Security regression test verification (2026-10-29)

A fresh, isolated disposable database `sharewise_security_run_20261029_db` was created in local Docker PostgreSQL (`sharewise-postgres-test`). Prior databases (`sharewise_test_db`, `sharewise_concurrency_test_db`, etc.) were preserved untouched.

1. **Bootstrap & Migrations Applied**:
   - `supabase/tests/local_test_bootstrap.sql`
   - `supabase/migrations/202610280001_profiles.sql`
   - `supabase/migrations/202610280002_sharewise_core_tables.sql`
   - `supabase/migrations/202610280003_booking_rpcs.sql`
   All applied in documented order with `ON_ERROR_STOP=1` and exited with status 0.

2. **Functional RPC & Trigger Test (`booking_rpcs_test.sql`)**:
   - Run in a fresh `psql` session with no session/role default for `sharewise.authorized_booking_transition`.
   - Results: Test 1, Test 2, Tests 2A–2B (trigger rejection on absent and false flag), Tests 3–11, 7A–7C, and 13 all **Passed**. Test 12 was reported as `NOT RUN` by design. Final transaction rolled back cleanly. Exit status: 0.

3. **Authenticated Permission Test (`booking_time_permissions_authenticated.sql`)**:
   - Executed under `SET LOCAL ROLE authenticated`.
   - Results: Direct `INSERT` into `condition_reports` and direct `UPDATE` attempts on `start_time`, `end_time`, `status`, `decision_by`, `decision_at`, `decision_reason`, `checked_in_at`, and `returned_at` all raised SQLSTATE `42501` (privilege denied), successfully distinguishing SQL permissions from RLS zero-row outcomes. RLS own-row/other-row controls behaved as expected. Final transaction rolled back cleanly. Exit status: 0.

4. **Transaction-Local Flag Scope Test (`booking_transition_flag_scope.sql`)**:
   - Executed in a single persistent `psql` session.
   - Results: Verified that `sharewise.authorized_booking_transition` reverted to session `false` baseline after both `COMMIT` and `ROLLBACK`. Exit status: 0.
