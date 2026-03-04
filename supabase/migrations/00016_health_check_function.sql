-- Health check introspection function for /api/health endpoint
-- Returns schema integrity data that PostgREST can't access directly

CREATE OR REPLACE FUNCTION check_system_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  tables_data jsonb;
  rls_data jsonb;
  functions_data jsonb;
  triggers_data jsonb;
BEGIN
  -- Get all public schema tables
  SELECT jsonb_agg(tablename)
  INTO tables_data
  FROM pg_tables
  WHERE schemaname = 'public';

  -- Get tables with RLS disabled
  SELECT jsonb_agg(tablename)
  INTO rls_data
  FROM pg_tables
  WHERE schemaname = 'public'
    AND NOT rowsecurity;

  -- Check critical functions exist
  SELECT jsonb_agg(p.proname)
  INTO functions_data
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname IN ('handle_new_user', 'is_admin');

  -- Check critical triggers exist
  SELECT jsonb_agg(trigger_name)
  INTO triggers_data
  FROM information_schema.triggers
  WHERE event_object_schema = 'auth'
    AND trigger_name = 'on_auth_user_created';

  result := jsonb_build_object(
    'existing_tables', COALESCE(tables_data, '[]'::jsonb),
    'rls_disabled_tables', COALESCE(rls_data, '[]'::jsonb),
    'existing_functions', COALESCE(functions_data, '[]'::jsonb),
    'existing_triggers', COALESCE(triggers_data, '[]'::jsonb)
  );

  RETURN result;
END;
$$;

-- Restrict access to service_role only (F2 — prevent info disclosure via PostgREST)
REVOKE ALL ON FUNCTION check_system_health() FROM PUBLIC;
REVOKE ALL ON FUNCTION check_system_health() FROM anon;
REVOKE ALL ON FUNCTION check_system_health() FROM authenticated;
GRANT EXECUTE ON FUNCTION check_system_health() TO service_role;
