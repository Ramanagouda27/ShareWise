# ShareWise Database Handoff — Member 3

This handoff contains the database migrations, local PostgreSQL bootstrap, functional and permission tests, two-session concurrency protocol, and integration contract.

## Verification snapshot (2026-10-29)

- The existing local databases were preserved. Bootstrap and migrations 001–003 were applied in order to the fresh disposable `sharewise_predeploy_verify_20261029_1_db`; no existing database was reset or had migrations reapplied.
- The audit records an earlier functional RPC suite revision run in `sharewise_predeploy_verify_20261029_1_db`, ending with `ROLLBACK`; Tests 1–11, 7A–7C, and 13 reported `Passed`, while Test 12 was `NOT RUN`. The trigger and per-RPC authorization checks added after that recorded run have not been executed.
- The audit records an earlier authenticated permission suite revision passing in `sharewise_predeploy_verify_20261029_1_db` using `SET LOCAL ROLE authenticated`. That revision checked condition-report INSERT denial, booking-time UPDATE denial, and own-row/resource-owner RLS behavior, then rolled back. The newly added booking lifecycle-column UPDATE assertions have not been executed.
- The four concurrency scenarios passed in the separate disposable database `sharewise_concurrency_test_db`; guarded cleanup was verified. The audit records summarized results; raw two-session transcripts are not stored in the repository. Existing local databases and their prior fixtures were preserved.
- `review_booking` rechecks that the resource is `active` before approval; Test 7C verifies a maintenance transition after request creation.
- Authenticated clients can read condition reports but cannot insert them directly; checkout/return lifecycle RPCs create initial/final reports. Resource creation is intentionally self-service for the MVP, with `owner_id = auth.uid()` enforced by RLS.
- No existing database was reset or had migrations reapplied. No shared Supabase connection or deployment was made.

See [`docs/database-final-integration-audit.md`](docs/database-final-integration-audit.md) for commands, detailed results, limitations, and owner next steps. See [`docs/database-integration-contract.md`](docs/database-integration-contract.md) for schema, RPC, permission, and concurrency contracts.

## Local safety

Run the SQL tests only against an isolated local database. The functional and authenticated permission suites roll back. The concurrency setup commits fixtures and successful race outcomes; use a fresh disposable database or follow its guarded cleanup after reviewing fixture identity. Do not reset the existing test database or reapply migrations blindly.

## Additional security test commands

After applying the local bootstrap and migrations 001–003 to a fresh disposable local database, set `$testDb` to that database name and run these from the repository root:

```powershell
$testDb = "sharewise_security_test_db"
Get-Content -Raw .\supabase\tests\booking_rpcs_test.sql | docker exec -i sharewise-postgres-test psql -X -U sharewise_test -d $testDb -v ON_ERROR_STOP=1
Get-Content -Raw .\supabase\tests\booking_time_permissions_authenticated.sql | docker exec -i sharewise-postgres-test psql -X -U sharewise_test -d $testDb -v ON_ERROR_STOP=1
Get-Content -Raw .\supabase\tests\booking_transition_flag_scope.sql | docker exec -i sharewise-postgres-test psql -X -U sharewise_test -d $testDb -v ON_ERROR_STOP=1
```

The functional suite checks trigger rejection with the authorization flag absent and false, then verifies each successful lifecycle RPC sets it. The absent-flag case requires a fresh `psql` session with no role-level or database-level default for `sharewise.authorized_booking_transition`; otherwise it fails its precondition. The authenticated permission suite attempts direct updates to protected booking columns and requires SQLSTATE `42501`. The flag-scope script must run as one `psql` process so it can verify that the session-level false baseline is restored after both `COMMIT` and `ROLLBACK`; it changes no application tables. These added checks have not been runtime-verified in this handoff revision.
