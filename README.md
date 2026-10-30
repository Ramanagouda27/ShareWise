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

The currently configured demo catalogue contains six illustrative entries: a Rigol DS1054Z oscilloscope, NVIDIA Jetson Orin Nano kit, Original Prusa MK4 3D printer, Intel RealSense D435i camera, Raspberry Pi 5 starter kit, and Hakko FX-888D soldering station. Replace the demo inventory and locations with institution-verified information before real-world use.

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

The repo also includes SQL test scripts under `supabase/tests/`.

To link the CLI to a project and apply pending migrations:

```bash
npx supabase@latest login
npx supabase@latest link --project-ref YOUR_PROJECT_REF
npx supabase@latest db push --linked
```

Review migrations and the target project before applying them. The configured hosted demo has these migrations applied. A fresh database will also need appropriate resource inventory and an authorized owner/profile setup; the six demo rows in the hosted project are not inserted by the three migrations.

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

## Important integration notes

- **Owner permissions:** Live auth currently defaults signed-in users to the student UI role until trusted role/profile mapping is connected. The owner dashboard UI and database RPCs exist, but an authorized owner account and role/profile contract must be configured and verified before treating owner approval, checkout, and return as production-ready. The demo persona switcher is not an authorization mechanism.
- **Email recovery:** The recovery and reset pages are implemented. Actual recovery-email delivery depends on Supabase Auth URL allow-list settings and the project's email provider/rate limits.
- **Demo inventory:** The six hosted catalogue entries are illustrative demo data, not verification of physical campus inventory. Confirm equipment, ownership, availability, locations, and safety rules with the institution before real use.
- **Security:** Never expose Supabase secret/service-role keys in the browser. Keep booking authorization and state transitions enforced in trusted backend/database code and RLS policies.

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
