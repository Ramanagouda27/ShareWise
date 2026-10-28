-- ==============================================================================
-- ShareWise Migration: 202610280001_profiles.sql
-- Module: Database, Authentication, and Permissions
--
-- Security Design Overview:
-- 1. Hardened Search Path & Function Execution:
--    - Functions execute with empty search_path ('SET search_path = ''') and
--      explicit schema qualification (pg_catalog.*, public.*, auth.*) to eliminate
--      search_path hijacking vulnerabilities.
--    - EXECUTE privileges on trigger functions are explicitly revoked from PUBLIC,
--      anon, and authenticated.
-- 2. Principle of Least Privilege & Column-Level Grants:
--    - RLS is enabled on public.profiles.
--    - Direct table permissions are strictly scoped:
--      * SELECT on public.profiles is granted to authenticated.
--      * UPDATE on public.profiles is granted ONLY on column (display_name).
--      * No direct INSERT or DELETE permissions are granted to client roles.
-- 3. Row-Level Security:
--    - Authenticated users can SELECT only their own row ((SELECT auth.uid()) = id).
--    - Authenticated users can UPDATE only their own row.
-- 4. Defense-in-Depth Column Protection:
--    - In addition to column-level grants, the handle_profile_update trigger rejects
--      any attempt to modify id, institution_status, created_at, or updated_at.
--    - updated_at is strictly database-controlled and bumped via pg_catalog.now().
-- 5. Verification Workflow Note:
--    - institution_status cannot be modified through user updates. Users cannot verify
--      themselves. A separately authorized database function (e.g. admin RPC with role checks)
--      or a trusted backend service workflow (e.g. service_role) is required to set
--      institution_status to 'verified' or 'rejected'.
-- ==============================================================================

-- 1. Create public.profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id pg_catalog.uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name pg_catalog.text NOT NULL,
    institution_status pg_catalog.text NOT NULL DEFAULT 'pending',
    created_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now(),
    updated_at pg_catalog.timestamptz NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT chk_institution_status CHECK (institution_status IN ('pending', 'verified', 'rejected'))
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to access objects in the public schema.
-- Individual table privileges and RLS still control access to profiles.
GRANT USAGE ON SCHEMA public TO authenticated;

-- 3. Revoke broad permissions and assign least-privilege column grants
REVOKE ALL ON TABLE public.profiles FROM PUBLIC;
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.profiles FROM authenticated;

-- Allow authenticated users to read profiles
GRANT SELECT ON TABLE public.profiles TO authenticated;

-- Allow authenticated users to update ONLY their display_name column
GRANT UPDATE (display_name) ON TABLE public.profiles TO authenticated;

-- 4. RLS Policies
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Read policy: users can only read their own profile row
CREATE POLICY "Users can read own profile"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = id);

-- Update policy: users can only update their own profile row
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = id)
    WITH CHECK ((SELECT auth.uid()) = id);

-- 5. Trigger Function: Update timestamp and enforce immutable fields
CREATE OR REPLACE FUNCTION public.handle_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Disallow changes to primary key
    IF NEW.id IS DISTINCT FROM OLD.id THEN
        RAISE EXCEPTION 'Modification of profile ID is not permitted.';
    END IF;

    -- Disallow changes to institution_status
    -- Note: Users cannot verify themselves. A separately authorized database function
    -- or trusted backend workflow running under elevated privileges is required to update
    -- institution_status to 'verified' or 'rejected'.
    IF NEW.institution_status IS DISTINCT FROM OLD.institution_status THEN
        RAISE EXCEPTION 'Modification of institution_status is not permitted.';
    END IF;

    -- Disallow changes to created_at
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Modification of created_at timestamp is not permitted.';
    END IF;

    -- Disallow client manipulation of updated_at
    IF NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN
        RAISE EXCEPTION 'Direct modification of updated_at timestamp is not permitted.';
    END IF;

    -- Automatically bump updated_at timestamp under database control
    NEW.updated_at := pg_catalog.now();

    RETURN NEW;
END;
$$;

-- Revoke execute privileges on the update trigger function
REVOKE ALL ON FUNCTION public.handle_profile_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_profile_update() FROM anon;
REVOKE ALL ON FUNCTION public.handle_profile_update() FROM authenticated;

-- Attach update-enforcement trigger
DROP TRIGGER IF EXISTS trg_profiles_handle_update ON public.profiles;
CREATE TRIGGER trg_profiles_handle_update
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_profile_update();

-- 6. Trigger Function: Automatically create profile on user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_display_name pg_catalog.text;
BEGIN
    -- Extract display name from user_metadata if available, fallback to email prefix or default
    v_display_name := NULLIF(
    pg_catalog.btrim(NEW.raw_user_meta_data->>'display_name'),
    ''
);

IF v_display_name IS NULL THEN
    v_display_name := NULLIF(
        pg_catalog.btrim(NEW.raw_user_meta_data->>'full_name'),
        ''
    );
END IF;


    IF v_display_name IS NULL AND NEW.email IS NOT NULL THEN
        v_display_name := pg_catalog.split_part(NEW.email, '@', 1);
    END IF;

    IF v_display_name IS NULL OR v_display_name = '' THEN
        v_display_name := 'ShareWise User';
    END IF;

    INSERT INTO public.profiles (
        id,
        display_name,
        institution_status,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        v_display_name,
        'pending',
        pg_catalog.now(),
        pg_catalog.now()
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- Revoke execute privileges on the registration trigger function
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;

-- Attach registration trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
