-- ============================================================
-- Función para que el admin global vea los correos de todos los usuarios
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION admin_get_user_emails()
RETURNS TABLE (id UUID, email TEXT) AS $$
BEGIN
  -- Solo admins globales pueden llamar esta función
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  ) THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  RETURN QUERY
    SELECT au.id, au.email::TEXT
    FROM auth.users au;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permitir que usuarios autenticados llamen la función
GRANT EXECUTE ON FUNCTION admin_get_user_emails() TO authenticated;
