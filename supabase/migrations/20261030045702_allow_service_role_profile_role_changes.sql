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

  -- Authenticated clients cannot update this column (column-level GRANT below).
  -- Even if a future grant changes, only a trusted service_role JWT may modify it.
  IF NEW.role IS DISTINCT FROM OLD.role
     AND COALESCE(pg_catalog.current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
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
