# ShareWise

**Unlock underused equipment and spaces through responsible sharing.**

ShareWise is a resource-sharing prototype designed to help people discover resources, request access, and coordinate their use. The project focuses on making shared-resource access more organized, transparent, and accountable.

> **Project status:** Prototype in development. Some booking interactions are currently frontend demonstrations. Database-backed booking persistence, authorization, and the complete sharing lifecycle must be verified before describing them as implemented.

## Project Goals

- Make resources easier to discover.
- Support a structured booking-request workflow.
- Define booking status transitions and prevent overlapping reservations.
- Support responsible resource use through future check-in/check-out and condition-report workflows.
- Protect user information through appropriate authentication, authorization, and database access policies.

## Technology Stack

- **Frontend:** React, TypeScript, Vite
- **Styling:** CSS
- **Backend integration:** Booking service interface prepared for a future Supabase implementation
- **Database and authentication:** Supabase integration is under development

## Current Implementation

### Booking logic

The `src/booking/` directory contains:

- `types.ts` — booking input, booking result, booking status, and error types.
- `rules.ts` — local booking time validation, overlap detection, and permitted status transitions.
- `errors.ts` — normalization of booking errors into safe, user-facing messages.
- `service.ts` — the `BookingService` contract for requesting and retrieving bookings.
- `rules.test.mjs` — tests for booking validation, conflicts, and status transitions.
- `errors.test.mjs` — tests for safe error normalization.

**Important:** The booking rules and service interface do not, by themselves, enforce database-level constraints. The current service contract is not a completed Supabase implementation.

### Booking status model

The local rules define these statuses:

- `pending`
- `approved`
- `rejected`
- `waitlisted`
- `checked_out`
- `returned`
- `cancelled`
- `overdue`

Permitted transitions are defined in `src/booking/rules.ts`. Production use requires appropriate server-side authorization and database enforcement as well.

### User profiles

A profiles migration has been prepared for the project. Its database behavior, authorization policies, and verification workflow must be tested against the actual deployment before being treated as production-ready.

## Prerequisites

Install:

- Node.js (the project has been tested with Node.js 24)
- npm
- Git

## Getting Started

Clone the repository:

```bash
git clone https://github.com/Ramanagouda27/ShareWise.git
cd ShareWise
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local URL printed by Vite in your terminal.

## Validation

### Run booking tests

The project uses Node.js's built-in test runner and TypeScript type stripping:

```bash
node --experimental-strip-types --test src/booking/rules.test.mjs src/booking/errors.test.mjs
```

The booking test suite currently contains 15 tests covering time validation, overlap detection, permitted status transitions, and safe error handling.

### Run lint

```bash
npm run lint
```

### Run production build

```bash
npm run build
```

These checks validate the current codebase. Passing them does not establish that Supabase integration, authorization, or the complete end-to-end booking journey works.

## Security and Reliability Considerations

Before using ShareWise for real bookings:

- Enforce booking authorization and state transitions on the server or database.
- Prevent conflicting reservations using reliable database-level concurrency controls.
- Validate resource eligibility and booking time ranges at the trusted backend boundary.
- Apply least-privilege database permissions and test Row Level Security policies.
- Restrict profile verification to an authorized workflow.
- Keep sensitive information out of user-facing errors and logs.
- Test the complete flow with separate requester and owner accounts.

## Project Links

- **Repository:** https://github.com/Ramanagouda27/ShareWise
- **Pull requests:** https://github.com/Ramanagouda27/ShareWise/pulls

## Team and Contributions

Document each team member's actual responsibilities and contributions before submission. Identify existing templates, libraries, and reused code where required by the hackathon rules.

## Demo and Submission Checklist

Before presenting the prototype, verify:

- [ ] The application starts successfully.
- [ ] Resource discovery and filtering work as demonstrated.
- [ ] The booking workflow is clearly identified as a demo or a persisted workflow, as applicable.
- [ ] Requester and owner permissions are tested.
- [ ] Booking conflicts and invalid status transitions are handled.
- [ ] Database persistence and authorization are verified if enabled.
- [ ] Demo instructions and test accounts are documented without exposing secrets.
- [ ] Known limitations are disclosed.
