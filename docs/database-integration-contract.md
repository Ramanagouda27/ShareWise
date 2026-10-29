# ShareWise Database Integration Contract
**Module**: Database, Authentication, and Permissions
**Author**: Member 2 (Database & Security)
**Target Consumers**: Member 3 (Booking & Frontend), Member 1 (Lead/Core)
**Status**: Migration Drafts Local Only (`202610280002_sharewise_core_tables.sql`, `202610280003_booking_rpcs.sql`).
**Shared Production Applied**: `202610280001_profiles.sql` (Commit: `15deeac` / Integration PR: `fb76090`).

---

## 1. Schema Overview & Table Structures

All primary keys use `pg_catalog.gen_random_uuid()` (`UUID`). All timestamps are `TIMESTAMPTZ` defaulting to `now()`.

### 1.1 `public.profiles` (Applied)
* `id` (`UUID`, PK, `REFERENCES auth.users(id) ON DELETE CASCADE`)
* `display_name` (`TEXT NOT NULL`)
* `institution_status` (`TEXT NOT NULL DEFAULT 'pending'`, CHECK: `'pending'`, `'verified'`, `'rejected'`)
* `created_at` (`TIMESTAMPTZ`)
* `updated_at` (`TIMESTAMPTZ`)
* *Grants*: `SELECT`, `UPDATE (display_name)` to `authenticated`. Direct `INSERT`/`DELETE` blocked.
* *Note on MVP*: Institution verification is **optional and out of scope for the MVP**.

### 1.2 `public.resources`
* `id` (`UUID`, PK)
* `owner_id` (`UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT`)
* `name` (`TEXT NOT NULL`), `description` (`TEXT`), `category` (`TEXT`), `location` (`TEXT`)
* `image_path` (`TEXT`), `usage_rules` (`TEXT`), `required_training` (`TEXT`)
* `max_booking_minutes` (`INT4`, `> 0`)
* `status` (`TEXT`, CHECK: `'active'`, `'inactive'`, `'maintenance'`)
* `created_at`, `updated_at` (`TIMESTAMPTZ`)
* *RLS*: `SELECT` for active resources or owner; `INSERT`, `UPDATE` for owner.

### 1.3 `public.availability_blocks`
* `id` (`UUID`, PK)
* `resource_id` (`UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE`)
* `start_time`, `end_time` (`TIMESTAMPTZ`, CHECK: `start_time < end_time`)
* `status` (`TEXT`, CHECK: `'active'`, `'cancelled'`), `reason` (`TEXT`), `created_at` (`TIMESTAMPTZ`)
* *RLS*: `SELECT` active blocks; owner manages blocks.
* *Conflict guard*: a database trigger locks the parent resource and rejects an active block that overlaps a `pending`, `approved`, `checked_out`, or `overdue` booking. This applies to inserts, activation, interval changes, and resource reassignment.

### 1.4 `public.bookings`
* `id` (`UUID`, PK)
* `resource_id` (`UUID NOT NULL REFERENCES resources(id) ON DELETE RESTRICT`)
* `requester_id` (`UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT`)
* `start_time`, `end_time` (`TIMESTAMPTZ`, CHECK: `start_time < end_time`)
* `purpose` (`TEXT NOT NULL`)
* `status` (`TEXT`, CHECK: `'pending'`, `'approved'`, `'rejected'`, `'waitlisted'`, `'checked_out'`, `'returned'`, `'cancelled'`, `'overdue'`)
* `decision_by` (`UUID REFERENCES profiles(id) ON DELETE SET NULL`), `decision_at` (`TIMESTAMPTZ`), `decision_reason` (`TEXT`)
* `checked_in_at` (`TIMESTAMPTZ`), `returned_at` (`TIMESTAMPTZ`)
* `created_at`, `updated_at` (`TIMESTAMPTZ`)
* *Direct Permissions*: `SELECT` (parties only), `UPDATE (purpose)` while `pending`.
* *MVP time editing*: Unsupported. Requesters must cancel the booking and submit a new request to change its time.
* *INSERT*: **Denied to direct clients**. Insertion is strictly mediated by `request_booking(...)`.
* *Lifecycle Protection Trigger*: Blocks direct client changes to `status`, decisions, and checkin/checkout timestamps. Authorized RPCs set transaction GUC `sharewise.authorized_booking_transition = 'true'`.

### 1.5 `public.eligibility_records`
* `id` (`UUID`, PK)
* `user_id` (`UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT`)
* `requirement_type` (`TEXT NOT NULL`), `status` (`TEXT`, CHECK: `'pending_review'`, `'verified'`, `'rejected'`, `'expired'`)
* `verified_by` (`UUID REFERENCES profiles(id) ON DELETE SET NULL`), `verified_at` (`TIMESTAMPTZ`), `expires_at` (`TIMESTAMPTZ`), `created_at` (`TIMESTAMPTZ`)
* *Constraint*: `user_id IS DISTINCT FROM verified_by` (prevents self-verification).
* *MVP Rule*: Optional and out of scope unless a resource explicitly defines a non-empty `required_training`.

### 1.6 `public.condition_reports`
* `id` (`UUID`, PK)
* `booking_id` (`UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT`)
* `reporter_id` (`UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT`)
* `report_type` (`TEXT`, CHECK: `'initial'`, `'final'`), `notes` (`TEXT`), `image_path` (`TEXT`), `created_at` (`TIMESTAMPTZ`)
* *Read access*: Booking requester and resource owner only. Direct authenticated `INSERT` is denied; `check_in_booking` and `return_booking` create the `initial` and `final` records through lifecycle RPCs.

### 1.7 `public.incidents`
* `id` (`UUID`, PK)
* `booking_id` (`UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT`), `reporter_id` (`UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT`)
* `category` (`TEXT`), `description` (`TEXT`), `status` (`TEXT`, CHECK: `'open'`, `'under_review'`, `'resolved'`, `'dismissed'`)
* `reviewer_id` (`UUID REFERENCES profiles(id) ON DELETE SET NULL`), `resolution_notes` (`TEXT`), `created_at`, `updated_at` (`TIMESTAMPTZ`)

### 1.8 `public.audit_events` (Append-Only)
* `id` (`UUID`, PK), `actor_id` (`UUID`), `resource_id` (`UUID`), `booking_id` (`UUID`)
* `event_type` (`TEXT`), `reason` (`TEXT`), `metadata` (`JSONB`), `created_at` (`TIMESTAMPTZ`)
* *Security*: No client `INSERT`/`UPDATE`/`DELETE`. Appended exclusively by RPCs and system triggers.

---

## 2. Booking RPC Specifications & Signatures

All RPCs are defined with `SECURITY DEFINER` and `SET search_path = ''`. They return JSONB formatted to match TypeScript `BookingRpcResponse<T>`.

### 2.1 Standard Response Envelopes
```typescript
// Success (HTTP 200 via PostgREST RPC)
{
  "success": true,
  "code": "OK",
  "message": "...",
  "data": { ... }
}

// Business Rule Failure (HTTP 200 via PostgREST RPC)
{
  "success": false,
  "code": "UNAUTHENTICATED" | "NOT_AUTHORISED" | "RESOURCE_UNAVAILABLE" |
          "INELIGIBLE" | "INVALID_TIME_RANGE" | "BOOKING_CONFLICT" |
          "INVALID_STATUS_TRANSITION",
  "message": "...",
  "data": null
}
```

### 2.2 `public.request_booking`
* **Signature**:
  ```sql
  request_booking(
      p_resource_id UUID,
      p_start_time TIMESTAMPTZ,
      p_end_time TIMESTAMPTZ,
      p_purpose TEXT
  ) RETURNS JSONB
  ```
* **Authorization**: Authenticated user (`auth.uid()`).
* **Validation & Concurrency**:
  1. Checks non-empty purpose and `p_start_time < p_end_time` and `p_start_time > now()`.
  2. Acquires row lock `SELECT * FROM public.resources WHERE id = p_resource_id FOR UPDATE` to serialize concurrent requests.
  3. Verifies `resource.status = 'active'`.
  4. Enforces `max_booking_minutes` if configured.
  5. Checks `public.availability_blocks` for overlapping active blocks (`requested_start < block.end_time AND block.start_time < requested_end`). If found, returns `RESOURCE_UNAVAILABLE`.
  6. If `resource.required_training` is set, verifies caller has active verified `eligibility_records`.
  7. Confirms no overlapping bookings exist in status `('pending', 'approved', 'checked_out', 'overdue')`.
  8. Inserts booking in `'pending'` status and records transactional audit event.

### 2.3 `public.review_booking`
* **Signature**:
  ```sql
  review_booking(
      p_booking_id UUID,
      p_decision TEXT,        -- 'approve', 'reject', 'waitlist'
      p_reason TEXT DEFAULT NULL
  ) RETURNS JSONB
  ```
* **Authorization**: Resource owner only (`resource.owner_id = auth.uid()`).
* **Concurrency & Locking**:
  - Reads the booking to identify its parent, then locks the parent resource before locking the booking row.
  - The parent resource is the shared transaction lock used by booking requests, lifecycle transitions, and availability-block writes.
  - Locking the resource serializes concurrent approval transactions, preventing two overlapping pending bookings from being approved simultaneously.
* **Transitions**:
  - `pending` -> `approved`, `rejected`, or `waitlisted`.
  - `waitlisted` -> `approved`.
  - Before approval, rechecks that the resource status is still `active` while holding its row lock. If it is `maintenance` or `inactive`, returns `RESOURCE_UNAVAILABLE` and leaves the booking unchanged.
  - If approving, re-verifies that no overlapping `approved`, `checked_out`, or `overdue` booking exists under the resource lock.
  - Before approval, checks for overlapping active `public.availability_blocks` using the same interval overlap rule as `request_booking`. If a block overlaps, returns `RESOURCE_UNAVAILABLE`. These checks run while holding the parent resource row lock.
* **GUC Coordination**: Sets `sharewise.authorized_booking_transition = 'true'`.

### 2.4 `public.cancel_booking`
* **Signature**:
  ```sql
  cancel_booking(
      p_booking_id UUID
  ) RETURNS JSONB
  ```
* **Authorization**: Booking requester (`requester_id = auth.uid()`) or resource owner.
* **Transitions**:
  - Allowed from `pending`, `approved`, or `waitlisted` -> `cancelled`.
* **GUC Coordination**: Sets `sharewise.authorized_booking_transition = 'true'`.

### 2.5 `public.check_in_booking`
* **Signature**:
  ```sql
  check_in_booking(
      p_booking_id UUID,
      p_initial_condition_notes TEXT DEFAULT NULL
  ) RETURNS JSONB
  ```
* **Authorization**: Requester or Resource Owner.
* **Transitions**:
  - `approved` -> `checked_out`.
* **Side-effects**:
  - Sets `checked_in_at = now()`.
  - Inserts initial `condition_reports` record.
  - Appends audit event.

### 2.6 `public.return_booking`
* **Signature**:
  ```sql
  return_booking(
      p_booking_id UUID,
      p_final_condition_notes TEXT DEFAULT NULL
  ) RETURNS JSONB
  ```
* **Authorization**: Requester or Resource Owner.
* **Transitions**:
  - `checked_out` -> `returned`, `overdue` -> `returned`.
* **Side-effects**:
  - Sets `returned_at = now()`.
  - Inserts final `condition_reports` record.
  - Appends audit event.

---

## 2.6 Condition report write policy

Authenticated users may read condition reports for bookings in which they are a party, but direct client INSERT is intentionally denied by the missing table grant and missing INSERT-capable RLS policy. `check_in_booking` creates the `initial` report and `return_booking` creates the `final` report inside the authorized lifecycle RPCs. This prevents clients from bypassing checkout/return sequencing or creating duplicate lifecycle reports. The RPCs execute with their `SECURITY DEFINER` owner privileges. The authenticated permission test verifies the grant and policy state and requires a direct fixture-backed INSERT to raise SQLSTATE `42501`.

## 2.7 Resource owner creation model

For the MVP, resource creation is intentionally self-service: any authenticated user may create a resource, but RLS requires `owner_id = auth.uid()`. Owner-only management is based on that `owner_id`; there is no separate role column or administrator approval workflow in this database contract. If the product later requires institutional owner approval, add an explicit verified-owner/role model before deployment.

## 3. Concurrency & Conflict Policy

1. **Active Overlap Criteria**:
   Two intervals overlap if `requested_start < existing_end AND existing_start < requested_end`.
2. **Conflicting Statuses**:
   - `pending`
   - `approved`
   - `checked_out`
   - `overdue`
3. **Non-conflicting Statuses**:
   - `rejected`
   - `cancelled`
   - `returned`
4. **Locking Strategy**:
   Booking requests and lifecycle transitions lock the parent resource with `SELECT ... FOR UPDATE` before inserting/updating a booking. Availability-block insert/update/delete triggers lock the same parent resource before checking for overlapping active bookings. Active blocks are rejected if they overlap `pending`, `approved`, `checked_out`, or `overdue` bookings; booking requests return `RESOURCE_UNAVAILABLE` when a committed active block overlaps.
   Availability-block updates/deletes necessarily lock the block row before the `BEFORE` trigger can lock the parent. The trigger does not lock booking rows. When a block moves between resources, it locks both parents in UUID order, avoiding a cycle with resource-then-booking RPC locks. Elevated direct booking writes that bypass RPCs are outside this client contract.

---

## 4. Migration Status & Safety Verification

* **Local test database**: On 2026-10-29, read-only catalog inspection confirmed PostgreSQL 16.15, all eight core/profile tables with RLS enabled, all five booking RPC signatures, and `guard_availability_block_booking_conflict()` with its availability-block trigger. The current RPC owner is `sharewise_test`.
* **Role and ACL check**: Local `authenticated` is `NOLOGIN`, `NOSUPERUSER`, and `NOBYPASSRLS`. It has `UPDATE` on `bookings.purpose`, but not `start_time` or `end_time`.
* **Migration 001 shared status**: Historical repository metadata records this migration as applied to shared Supabase. That state was not independently verified during this audit.
* **Migrations 001–003**: They were not reapplied in-place to an existing database. The bootstrap and all three current migration files were applied in order to fresh disposable local databases `sharewise_handoff_verify_db` and, for the corrected final verification, `sharewise_predeploy_verify_20261029_1_db`. No shared deployment was made.
* **Isolation**: No frontend files were edited. No shared Supabase connection was made.

---

## 5. Test Scripts & Verification Harness

The audit records an earlier revision of `supabase/tests/booking_rpcs_test.sql` run in the fresh disposable local database `sharewise_predeploy_verify_20261029_1_db`. Tests 1–11, 7A–7C, and 13 reported `Passed`; Test 12 reported `NOT RUN` because the DO-block suite cannot change to a real authenticated role. That revision ended with `ROLLBACK`. Test 7C verifies that approval returns `RESOURCE_UNAVAILABLE` and leaves the booking pending after the resource enters maintenance. The trigger and per-RPC authorization checks added afterward have not been executed.

The audit records an earlier revision of `supabase/tests/booking_time_permissions_authenticated.sql` passing in the fresh disposable local database `sharewise_predeploy_verify_20261029_1_db` using `SET LOCAL ROLE authenticated`. That revision checked that no INSERT-capable condition-report policy or table INSERT privilege exists, attempted a valid direct INSERT and required SQLSTATE `42501`, and verified direct updates to booking `start_time` and `end_time` raised `42501` rather than merely affecting zero rows. It also tested own-row and resource-owner RLS behavior, then reset the role and rolled back. The lifecycle-column assertions added afterward have not been executed.

`supabase/tests/concurrent_booking_tests.sql` documents four two-session scenarios: booking/booking requests, overlapping approvals, booking wins against block creation, and block wins against booking. All four were run and passed in the separate disposable local database `sharewise_concurrency_test_db`; guarded cleanup was verified. The audit records the outcomes as summaries; raw session transcripts are not saved in the repository. The existing `sharewise_test_db` and its colliding fixtures were preserved. Setup and successful scenario effects commit; use a fresh disposable local database or validate and run the guarded cleanup manually before reuse.

See `docs/database-final-integration-audit.md` for commands run, output-based results, working-tree status, and next steps. Do not reset the existing database or reapply migrations blindly. To run the concurrency protocol without disturbing current fixtures, create a separate disposable local database, run the bootstrap and migrations there in order, and use two independent psql sessions. No reset or migration command should target shared Supabase.

### Additional booking security regression tests

The following added checks are intended for a fresh disposable local database after the local bootstrap and migrations 001–003 have been applied. Replace the example database name with that disposable database. These additions have not been runtime-verified; no pass result is claimed here.

```powershell
$testDb = "sharewise_security_test_db"
Get-Content -Raw .\supabase\tests\booking_rpcs_test.sql | docker exec -i sharewise-postgres-test psql -X -U sharewise_test -d $testDb -v ON_ERROR_STOP=1
Get-Content -Raw .\supabase\tests\booking_time_permissions_authenticated.sql | docker exec -i sharewise-postgres-test psql -X -U sharewise_test -d $testDb -v ON_ERROR_STOP=1
Get-Content -Raw .\supabase\tests\booking_transition_flag_scope.sql | docker exec -i sharewise-postgres-test psql -X -U sharewise_test -d $testDb -v ON_ERROR_STOP=1
```

`booking_rpcs_test.sql` uses the privileged local fixture harness to require trigger rejection when `sharewise.authorized_booking_transition` is absent and false. The absent-flag case requires a fresh `psql` session with no role-level or database-level default for this setting; otherwise it fails its precondition. Before each successful approval, check-in, return, and cancellation RPC, it sets the flag false and asserts that the RPC sets it true. The script retains its outer transaction and final rollback.

`booking_time_permissions_authenticated.sql` uses a real `SET LOCAL ROLE authenticated` session, verifies that UPDATE privileges are absent for booking time and lifecycle fields, and requires each direct UPDATE to raise SQLSTATE `42501`. Its fixture booking exists and is visible to the requester, and a distinct sentinel error makes a successful or zero-row update fail the test rather than count as permission denial.

`booking_transition_flag_scope.sql` must run in one persistent `psql` process/session. It sets a session-level false baseline, checks the transaction-local true value inside a transaction, then verifies the baseline returns after both `COMMIT` and `ROLLBACK`. It modifies no application tables and resets the session setting before exit.
