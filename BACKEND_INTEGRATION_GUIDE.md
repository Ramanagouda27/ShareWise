# ShareWise — Backend & Supabase Integration Guide

This document outlines the exact data contracts, tables, and authentication requirements needed to connect the ShareWise frontend to your live Supabase database.

---

## 1. Environment Configuration

Add the following to your `.env` file once your Supabase project is created:

```env
VITE_DATA_SOURCE=supabase
VITE_SUPABASE_URL=https://[YOUR_PROJECT_REF].supabase.co
VITE_SUPABASE_ANON_KEY=[YOUR_PUBLIC_ANON_KEY]
```

> **Security Note:** Only supply the **public `anon` key** to the frontend. Never provide the `service_role` secret key.

---

## 2. Proposed Database Schema

The frontend data contracts (`src/types/`) are designed to match the following clean relational structure:

### A. `profiles` Table
*(Managed alongside Supabase Auth `auth.users`)*

```sql
create type user_role as enum ('student', 'owner', 'admin');

create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text not null,
  role user_role default 'student' not null,
  student_id text,
  department text,
  college_name text default 'Campus Institute of Technology',
  avatar_url text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);
```

### B. `resources` Table

```sql
create table public.resources (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  description text not null,
  category text not null,
  image_url text,
  location text not null,
  owner_id uuid references public.profiles(id),
  total_quantity integer default 1 not null,
  available_quantity integer default 1 not null,
  is_available boolean default true not null,
  eligibility_requirements text[] default '{}',
  specifications jsonb default '{}'::jsonb,
  serial_number text,
  is_featured boolean default false,
  created_at timestamptz default timezone('utc'::text, now()) not null
);
```

### C. `bookings` Table

```sql
create type booking_status as enum (
  'pending',
  'approved',
  'rejected',
  'waitlisted',
  'checked_out',
  'returned',
  'cancelled',
  'overdue'
);

create table public.bookings (
  id text primary key default gen_random_uuid()::text,
  resource_id text references public.resources(id) on delete cascade not null,
  requester_id uuid references public.profiles(id) not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status booking_status default 'pending' not null,
  purpose_notes text,
  rejection_reason text,
  owner_notes text,
  checked_out_at timestamptz,
  returned_at timestamptz,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);
```

### D. `condition_reports` Table

```sql
create type condition_grade as enum (
  'excellent',
  'good',
  'fair',
  'damaged',
  'missing_parts'
);

create table public.condition_reports (
  id text primary key default gen_random_uuid()::text,
  booking_id text references public.bookings(id) on delete cascade not null,
  resource_id text references public.resources(id) on delete cascade not null,
  inspector_id uuid references public.profiles(id) not null,
  inspector_name text not null,
  stage text not null check (stage in ('checkout', 'return')),
  grade condition_grade not null,
  notes text,
  reported_damage text[] default '{}',
  photo_urls text[] default '{}',
  created_at timestamptz default timezone('utc'::text, now()) not null
);
```

---

## 3. Row Level Security (RLS) Recommendations

1. **Resources**:
   - `SELECT`: Public / authenticated students and owners can read all resources.
   - `INSERT / UPDATE`: Restricted to resource `owner_id` or `admin`.
2. **Bookings**:
   - `SELECT`: Users can view their own bookings (`requester_id = auth.uid()`), and lab owners can view bookings for resources they supervise.
   - `INSERT`: Authenticated users can insert new bookings with `status = 'pending'`.
   - `UPDATE`: Lab owners can update `status` and `notes`. Requesters can update `status = 'cancelled'` while status is `'pending'`.
3. **Condition Reports**:
   - `SELECT`: Viewable by the booking's requester and custodian.
   - `INSERT`: Lab custodians when processing handover or return.

---

## 4. Frontend Service Layer Integration Points

All queries and mutations in the frontend are consolidated in:
- `src/services/authService.ts`
- `src/services/resourceService.ts`
- `src/services/bookingService.ts`
- `src/services/conditionReportService.ts`

When `VITE_DATA_SOURCE=supabase` is set, these files directly invoke standard Supabase client methods. If column names differ in your final schema, update the mapping inside these service classes without modifying any React UI components.
