# ShareWise — Campus Equipment Sharing & Booking

ShareWise is a campus equipment discovery and reservation platform for students, project teams, researchers, and laboratory custodians. It helps people find shared lab equipment, request a time window, and track reservation status.

**Live demo:** https://share-wise-sable.vercel.app/  
**Repository:** https://github.com/Ramanagouda27/ShareWise

## What it does

- **Equipment catalogue:** Browse and search lab equipment, development boards, sensors, computing hardware, and prototyping tools.
- **Resource details:** View equipment descriptions, category, location, usage guidance, and availability indicators.
- **Student reservations:** Submit a booking request with a start time, return deadline, project/course purpose, and acknowledgement of equipment-handling requirements.
- **Reservation tracking:** Review bookings, see their current status and lifecycle timeline, and cancel eligible pending requests.
- **Authentication:** Sign up, sign in, and use the password-recovery/reset pages with Supabase Auth.
- **Owner workflow interface:** A lab-custodian dashboard is included for reviewing requests and handling checkout/return-condition steps.
- **Database-backed booking rules:** PostgreSQL RPCs centralize booking transitions and server-side validation rather than relying on client-side checks alone.

The hosted catalogue contains illustrative demonstration inventory, including a Rigol DS1054Z oscilloscope, NVIDIA Jetson Orin Nano kit, Original Prusa MK4 3D printer, Intel RealSense D435i camera, Raspberry Pi 5 starter kit, and Hakko FX-888D soldering station. Additional demo/test entries may be present in the live project. These records are not verification of physical campus inventory; confirm equipment, ownership, availability, locations, and safety rules with the institution before real-world use.

## Technology

- React 19, TypeScript, Vite, React Router
- Tailwind CSS 4, Framer Motion, Lucide icons
- Supabase Auth and PostgreSQL
- Row Level Security (RLS) and PostgreSQL booking RPCs
- Vercel deployment

## Run locally

### Requirements

- Node.js 24 recommended
- npm
- A Supabase project for live data, or use the app's mock mode for UI development

### 1. Install dependencies

```bash
npm ci
```

### 2. Configure environment variables

Create a `.env.local` file in the project root:

```dotenv
VITE_DATA_SOURCE=supabase
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

Replace the placeholders with values from your own Supabase project.

- Set `VITE_DATA_SOURCE=supabase` to use the live Supabase integration.
- For UI-only local work, omit `VITE_DATA_SOURCE=supabase` to use mock mode.
- Only use the Supabase publishable/anon client key in `VITE_SUPABASE_ANON_KEY`. **Never put a secret API key or legacy `service_role` key in a `VITE_*` variable, frontend code, or a committed file.**
- `.env.local` is local configuration and must not be committed.

### 3. Start the development server

```bash
npm run dev
```

Vite prints the local URL after startup.

## Supabase database

Migrations are in `supabase/migrations/`:

1. `202610280001_profiles.sql` — profile support
2. `202610280002_sharewise_core_tables.sql` — resources, bookings, and supporting domain tables/policies
3. `202610280003_booking_rpcs.sql` — booking request, review, cancellation, check-in, and return procedures
4. `20261030045541_owner_roles.sql` — trusted profile roles and custodian role assignment for the seeded demo resources
5. `20261030045702_allow_service_role_profile_role_changes.sql` — permits role changes only through the trusted service-role path in the profile trigger

The repo also includes SQL test scripts under `supabase/tests/`.

To link the CLI to a project and apply pending migrations:

```bash
npx supabase@latest login
npx supabase@latest link --project-ref YOUR_PROJECT_REF
npx supabase@latest db push --linked
```

Review migrations and the target project before applying them. The configured hosted demo has all five migrations applied; **do not rerun these migrations manually on the hosted project**. A fresh database also needs resource inventory and an authorized owner/profile setup; demo resources are not inserted by these schema migrations.

### Booking RPCs

The main lifecycle operations are:

- `request_booking`
- `review_booking`
- `cancel_booking`
- `check_in_booking`
- `return_booking`

Booking state changes should go through the RPC contract, which validates identity, authorization, time windows, conflicts, and allowed state transitions. Do not replace these calls with direct browser-side writes to booking status columns.

## Validation commands

```bash
npm run lint
npm run build
node --experimental-strip-types --test src/booking/rules.test.mjs src/booking/errors.test.mjs
```

The booking/error test command currently runs 13 automated tests. Vite may print a chunk-size advisory after a successful build; that advisory is not, by itself, a build failure.

## Deployment

The project is deployed on Vercel:

- **Production:** https://share-wise-sable.vercel.app/
- **Production branch:** `main`

Set the required `VITE_*` environment variables in Vercel for each environment that should use Supabase, then redeploy after environment or source changes. `vercel.json` rewrites application routes to `/index.html` so direct navigation to paths such as `/resources`, `/login`, and `/reset-password` works with the client-side router.

For Supabase Auth redirects, configure the production and preview URLs in the Supabase Auth URL Configuration. Reliable email delivery may require configuring a custom SMTP provider.

## Live roles, owner access, and evaluator setup

- **Trusted role mapping is implemented.** In Supabase mode, the app reads `display_name` and `role` from the user's protected `public.profiles` row. User-editable Auth metadata and the requested signup role do not grant owner access; accounts default to `student` unless a trusted administrator provisions an elevated role.
- **Owner route protection is implemented.** The `/owner/requests` route requires an `owner` role (or `admin`). The production owner workflow has been smoke-tested: student booking request, owner approval and rejection, checkout with an initial condition report, and return with a final condition report. A student-session direct-navigation test redirected away from the owner dashboard.
- **Role writes are restricted.** The authenticated database role cannot update `public.profiles.role`; the profile trigger only permits role changes through the trusted service-role path. Do not weaken this control or use the public signup form to assign an owner.
- **Dedicated evaluator account is a pre-evaluation task.** The hosted project currently has a designated custodian account used by the project team. Do not share that person's password or depend on evaluators accessing that mailbox. Before an external judging session, create a separate Auth user with a mailbox controlled by the team, provision its `public.profiles.role` as `owner` through a trusted administrative/service-role process, and create a clearly labelled `TEST ONLY` resource owned by that account. Verify that the evaluator owner can manage only its assigned demo resource and that a separate student account can request it. The evaluator account and resource must be set up in the hosted Supabase project; this repository documentation does not create them.
- **Evaluator credentials:** Never publish the personal custodian account password, recovery links, access tokens, Supabase secret keys, or the service-role key. If the hackathon provides no private credential channel, a shared public demo login is acceptable only for a deliberately disposable evaluator-owner account after it is verified to own exactly one isolated `TEST ONLY` resource and the backend limits its owner actions to that resource. Clearly label such credentials as public/shared in the approved public demo instructions, assume anyone can use them, and rotate or disable the account after judging. Do not publish demo-owner credentials before the isolated resource and access scope have been verified.
- **Email recovery:** Recovery and reset pages are implemented. Actual email delivery depends on Supabase Auth redirect allow-list settings and the configured email provider/rate limits.
- **Demo inventory:** Hosted resource records are illustrative test/demo data, not proof of physical campus inventory. Confirm equipment, ownership, availability, locations, and safety rules with the institution before real use.
- **Security:** Never expose Supabase secret/service-role keys in the browser. Keep booking authorization and state transitions enforced in trusted backend/database code and RLS policies.

## Production verification summary

The live production flow has been smoke-tested with designated test bookings through:
- student booking creation and reservation history;
- owner approval and rejection (including rejection reason);
- checkout/handover with an initial condition report;
- return verification with a final condition report; and
- student-role access to `/owner/requests` being redirected away from the owner dashboard.

These are smoke-test results, not a guarantee that every edge case has been tested. Automated GitHub Actions checks are not currently configured/reported for the owner-role pull request; the repo's documented local validation commands are `npm run lint`, `npm run build`, and the 13 booking/error tests.

## Project structure

```text
src/
  app/                 App shell and routes
  components/          Shared UI, resource and booking components
  context/             Authentication context
  pages/               Home, catalogue, sign-in, bookings, owner and recovery pages
  services/            Supabase client, auth, resource and booking integration
  mocks/               Mock catalogue and booking data
  types/               Shared TypeScript domain types
supabase/
  migrations/           Database schema, RLS and RPC migrations
  tests/                SQL test scripts
docs/                   Database integration contract and audit notes
```

## Team and contribution

ShareWise was built as a collaborative hackathon project. Review the Git history and team records to describe each contributor's individual work accurately.
