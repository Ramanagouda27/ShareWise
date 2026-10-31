-- Trusted live owner roles for ShareWise.
-- New and existing accounts default to student. Elevated roles are assigned only
-- by this migration or a trusted administrative/service workflow; clients may
-- update display_name only, and the profile trigger rejects role changes.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'student';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.profiles'::pg_catalog.regclass
      AND conname = 'profiles_role_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('student', 'owner', 'admin'));
  END IF;
END
$$;

-- Promote only the custodian of the six known seeded demo resources. Do not
-- promote other resource owners (e.g. a test account) implicitly.
DO $$
DECLARE
  v_owner_count integer;
  v_owner_id uuid;
BEGIN
  SELECT
    pg_catalog.count(DISTINCT r.owner_id),
    (pg_catalog.array_agg(DISTINCT r.owner_id))[1]
  INTO v_owner_count, v_owner_id
  FROM public.resources AS r
  WHERE r.name IN (
    'Rigol DS1054Z Digital Oscilloscope',
    'NVIDIA Jetson Orin Nano Developer Kit (8GB)',
    'Original Prusa MK4 3D Printer',
    'Intel RealSense D435i Depth Camera',
    'Raspberry Pi 5 8GB Starter Kit',
    'Hakko FX-888D Soldering Station'
  );

  IF v_owner_count IS DISTINCT FROM 1 OR v_owner_id IS NULL THEN
    RAISE EXCEPTION
      'Expected exactly one owner for the six seeded ShareWise resources; found %.',
      v_owner_count;
  END IF;

  UPDATE public.profiles
  SET role = 'owner'
  WHERE id = v_owner_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The seeded resource owner has no public profile.';
  END IF;
END
$$;

-- Defense in depth: the existing least-privilege grant permits client updates
-- only to display_name, and this trigger also makes role immutable to clients.
CREATE OR REPLACE FUNCTION public.handle_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Modification of profile ID is not permitted.';
  END IF;

  IF NEW.institution_status IS DISTINCT FROM OLD.institution_status THEN
    RAISE EXCEPTION 'Modification of institution_status is not permitted.';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Modification of role is not permitted.';
  END IF;

  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Modification of created_at timestamp is not permitted.';
  END IF;

  IF NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN
    RAISE EXCEPTION 'Direct modification of updated_at timestamp is not permitted.';
  END IF;

  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_profile_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_profile_update() FROM anon;
REVOKE ALL ON FUNCTION public.handle_profile_update() FROM authenticated;

REVOKE UPDATE ON TABLE public.profiles FROM authenticated;
GRANT UPDATE (display_name) ON TABLE public.profiles TO authenticated;
