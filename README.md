# ShareWise — Campus Equipment Sharing & Booking Platform

**ShareWise** is a modern, light-theme college equipment-sharing and lab reservation web application built for hackathon demonstration and seamless Supabase backend integration.

---

## ⚡ Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run the development server
npm run dev

# 3. Build for production
npm run build

# 4. Preview production build
npm run preview
```

The application will be running at `http://localhost:5173`.

---

## 🎨 Visual System & UI/UX

- **Design Philosophy**: White Premium SaaS.
- **Palette**: Clean white (`#FFFFFF`), subtle charcoal (`#171717`), soft borders (`#E5E7EB`), muted slate (`#737373`), and restrained indigo/blue action accents.
- **Typography**: Inter & Plus Jakarta Sans with crisp geometric hierarchy.
- **3D Hero Integration**: Official Spline runtime integration (`SplineHeroBackground.tsx`) configured for your custom 3D scene with edge-fade gradient overlays and high-tech schematic canvas fallback.

---

## 🧭 Routes & Demonstrated Flows

| Route | View | Description |
|---|---|---|
| `/` | **Landing Page** | Spline 3D hero slot, 3-step workflow, featured equipment showcase, dual-value proposition, and safety guidelines. |
| `/resources` | **Resource Discovery** | Live keyword search, category pills, location filters, availability toggle, and card grid with skeleton loaders. |
| `/resources/:id` | **Resource Details** | High-res imagery, technical specifications, custodian details, safety prerequisites, and reservation request form. |
| `/my-bookings` | **Student Dashboard** | Live booking counts, tabbed filters, status badges, and reservation cancellation with confirmation modal. |
| `/bookings/:id` | **Booking Details** | Detailed reservation schedule, chronological audit trail timeline, rejection notes, and digital condition reports. |
| `/owner/requests` | **Owner Review Hub** | In-depth lab custodian dashboard with Approve/Reject modal (with required reason) and Handover/Return condition logging. |
| `/login` & `/signup` | **Authentication** | Student ID & department fields, password visibility toggle, one-click hackathon demo persona switcher. |

---

## 🔄 Dual Adapter Architecture: Mock Demo vs Live Supabase

The frontend strictly isolates UI components from data-access logic via an adapter layer:

- **Mock Adapter (`VITE_DATA_SOURCE=mock`)**: Default mode for hackathon presentation. Persists data to `localStorage` with realistic async delay. Supports full end-to-end workflows: booking submission, custodian review, equipment handover condition audit, and return verification.
- **Supabase Adapter (`VITE_DATA_SOURCE=supabase`)**: Production-ready adapter wired to `@supabase/supabase-js`. Does not execute speculative RPC functions or fake records.

### Switching Demo Personas

A one-click demo persona switcher is embedded in the navigation bar and authentication screens:
1. **Alex Mercer (Student)**: Requests equipment, checks booking timelines, cancels reservations.
2. **Prof. David Vance (Lab Custodian)**: Reviews pending requests, approves/rejects with comments, executes handover and return condition inspections.

---

## 🔮 Spline 3D Scene Setup

To connect your custom Spline 3D hero scene:
1. Copy your public `.splinecode` URL from Spline export (e.g., `https://prod.spline.design/your-scene-id/scene.splinecode`).
2. Add it to `.env`:
   ```env
   VITE_SPLINE_SCENE_URL="https://prod.spline.design/your-scene-id/scene.splinecode"
   ```
3. Restart the Vite dev server. The scene will automatically render seamlessly behind the hero typography with white edge gradients.

---

## 🤝 Backend Handover & Integration Requirements

See [`BACKEND_INTEGRATION_GUIDE.md`](./BACKEND_INTEGRATION_GUIDE.md) for the exact database contract, proposed table definitions, and authentication requirements needed from the backend developer.
