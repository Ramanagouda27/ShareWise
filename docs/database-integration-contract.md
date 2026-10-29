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
* *Grants & RLS*: `SELECT` granted to `authenticated` (view active or owned resources) and `anon` (restricted by policy "Anonymous users can view active resources" strictly to `status = 'active'`; maintenance and inactive resources are hidden). `INSERT`, `UPDATE` for resource owner (`authenticated`).

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
          "INVALID_STATUS_TRANSITION" | "INVALID_INPUT",
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
  1. Checks non-empty purpose, `p_start_time < p_end_time`, and `p_start_time > now()`.
  2. Enforces a 30-minute minimum booking duration (`IF p_end_time - p_start_time < INTERVAL '30 minutes'`). Callers requesting a duration shorter than 30 minutes receive `success: false`, `code: "INVALID_TIME_RANGE"`, `message: "Booking duration must be at least 30 minutes."`, and `data: null`. No booking row is created.
  3. Acquires row lock `SELECT * FROM public.resources WHERE id = p_resource_id FOR UPDATE` to serialize concurrent requests.
  4. Verifies `resource.status = 'active'`.
  5. Enforces `max_booking_minutes` if configured.
  6. Checks `public.availability_blocks` for overlapping active blocks (`requested_start < block.end_time AND block.start_time < requested_end`). If found, returns `RESOURCE_UNAVAILABLE`.
  7. If `resource.required_training` is set, verifies caller has active verified `eligibility_records`.
  8. Confirms no overlapping bookings exist in status `('pending', 'approved', 'checked_out', 'overdue')`.
  9. Inserts booking in `'pending'` status and records transactional audit event.

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
* **Validation & Input Guarding**:
  - Validates decision verb (`approve`, `reject`, `waitlist`).
  - When `p_decision = 'reject'`, requires a non-empty rejection reason (`pg_catalog.btrim(COALESCE(p_reason, '')) != ''`). If `p_reason` is null, empty, or whitespace-only, returns `success: false`, `code: "INVALID_INPUT"`, `message: "A rejection reason is required."`, and `data: null`. The booking remains in `pending` status.
  - When a valid rejection reason is supplied, the booking transitions to `rejected` and the reason text is persisted into `bookings.decision_reason`.
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

* **Local test database**: PostgreSQL 16.15 running in local Docker container `sharewise-postgres-test`.
* **Role and ACL check**: Local `authenticated` is `NOLOGIN`, `NOSUPERUSER`, and `NOBYPASSRLS`. It has `UPDATE` on `bookings.purpose`, but direct updates to `start_time`, `end_time`, and all lifecycle columns (`status`, `decision_by`, `decision_at`, `decision_reason`, `checked_in_at`, `returned_at`) are revoked. Local `anon` has `SELECT` on `public.resources` strictly scoped to `status = 'active'` rows by RLS.
* **Migration 001 shared status**: Confirmed present in live Supabase SQL Editor / dashboard, but not baselined in `supabase_migrations.schema_migrations`.
* **Migrations 001–003**: The bootstrap and all three migration files applied in order with `ON_ERROR_STOP=1` (all exit code 0) to fresh disposable local database `sharewise_member3_verify_db` on 2026-10-30.
* **Deployment Blockers**:
  1. **Full live schema/data backup**: NOT VERIFIED / BLOCKER. Backup automation scripts were reviewed locally for PowerShell syntax and argument safety, but no verified full backup has been executed against or validated from shared Supabase.
  2. **Migration-ledger baseline**: Migration 001 must be baselined into the CLI tracking table (`supabase migration repair --status applied 202610280001`) before running any remote migrations.
* **Isolation**: All tests ran locally in disposable Docker PostgreSQL. No remote SQL, `supabase db push`, migration repair, or production seeding was executed against shared Supabase.

---

## 5. Test Scripts & Verification Harness

### 5.1 Latest Clean-Room Verification (2026-10-30)

The bootstrap and migrations 001–003 were applied in order with `ON_ERROR_STOP=1` to fresh disposable local database `sharewise_member3_verify_db`:

1. **`supabase/tests/booking_rpcs_test.sql` (Exit code: 0)**:
   - **Passed (17 of 17 runnable checks)**:
     - Test 1: Unauthenticated request rejected (`UNAUTHENTICATED`).
     - Test 2: Booking successfully created in `pending` status.
     - **Test 2C**: Database enforces 30-minute minimum duration (15-minute booking rejected with `INVALID_TIME_RANGE`, returns null data, no row created in `public.bookings`).
     - Tests 2A–2B: Lifecycle trigger rejects direct status updates on absent and false authorization flags.
     - Test 3: Overlapping booking conflict detected and rejected (`BOOKING_CONFLICT`).
     - Test 4: Active availability block conflict rejected (`RESOURCE_UNAVAILABLE`).
     - Test 5: Resource eligibility enforced accurately (`INELIGIBLE`).
     - Test 6: Unauthorized reviewer rejected (`NOT_AUTHORISED`).
     - Test 7: Owner approved booking; audit event recorded (`previous_status=pending`, `new_status=approved`).
     - Test 7A: Overlapping availability block INSERT and UPDATE rejected by trigger.
     - Test 7B: Approval correctly rejected due to active availability block.
     - Test 7C: Approval rejected because resource entered `maintenance` after request (`RESOURCE_UNAVAILABLE`).
     - **Test 7D**: Blank/whitespace-only rejection reason rejected with `INVALID_INPUT` (booking remains `pending`); valid reason succeeds, transitions to `rejected`, and persists to `decision_reason`.
     - Test 8: Check-in transition and initial condition report recorded.
     - Test 9: Return transition and final condition report recorded.
     - Test 10: Invalid status transition blocked (`INVALID_STATUS_TRANSITION`).
     - Test 11: Dedicated cancellation succeeded.
     - Test 13: 121-minute booking correctly rejected against 120-minute ceiling limit (`INVALID_TIME_RANGE`).
   - **Deferred (Test 12 NOT RUN)**: Explicitly marked `NOT RUN` by design in the RPC suite because asserting `UPDATE` permission denial on booking time/lifecycle columns requires switching role to `authenticated` outside a single `DO $$` block. Test 12 is fully covered by `booking_time_permissions_authenticated.sql`.
   - **Teardown**: Script executed `ROLLBACK` (all test data discarded).

2. **`supabase/tests/booking_time_permissions_authenticated.sql` (Exit code: 0)**:
   - **Passed**: Under `SET LOCAL ROLE anon`, confirmed anonymous role can select active resources (count = 1) and is denied from selecting maintenance resources (count = 0).
   - **Passed**: Under `SET LOCAL ROLE authenticated`, confirmed direct `INSERT` into `condition_reports` and direct `UPDATE` of booking time (`start_time`, `end_time`) and lifecycle columns (`status`, `decision_by`, `decision_at`, `decision_reason`, `checked_in_at`, `returned_at`) are denied with SQLSTATE `42501` (privilege denied), distinguishing SQL permissions from RLS zero-row outcomes. RLS own-row and other-row controls also behaved as expected.
   - **Teardown**: Script executed `ROLLBACK` (all test data discarded).

3. **Database Tear Down**:
   - Confirmed row counts across all public tables and `auth.users` were 0 after rollbacks.
   - `DROP DATABASE sharewise_member3_verify_db;` executed cleanly with exit code 0.

### 5.2 Concurrency Scenarios (`concurrent_booking_tests.sql` — Historical Evidence)

`supabase/tests/concurrent_booking_tests.sql` documents four interactive two-session scenarios:
1. Overlapping booking requests (second request waits for first commit, then returns `BOOKING_CONFLICT`).
2. Concurrent booking approvals (second approval waits for first commit, then returns `BOOKING_CONFLICT`).
3. Booking wins vs. active block insert (block insert rejected with exception).
4. Active block wins vs. booking request (booking returns `RESOURCE_UNAVAILABLE`).

**Status**:
- These interactive scenarios **were not rerun** during the 2026-10-30 automated verification.
- They remain documented as **historical audit evidence** from their successful execution on **2026-10-29** in `sharewise_concurrency_test_db`.
- Because the protocol requires manual, synchronized interleaving across two interactive terminals (`docker exec -it ...`), raw automated transcripts are not stored in repository logs.

### 5.3 Additional Regression Tests (`booking_transition_flag_scope.sql` — Historical Evidence)

Executed on **2026-10-29** in `sharewise_security_run_20261029_db`: verified in a persistent `psql` session that `sharewise.authorized_booking_transition` reverted to session `false` baseline after both `COMMIT` and `ROLLBACK` (Exit code: 0).
