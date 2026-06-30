-- ============================================================
-- Seguridad: activar RLS en knockout_multipliers
-- (el security advisor la marcó como "rls_disabled_in_public":
--  estaba expuesta a lectura/escritura pública por cualquiera con la URL).
--
-- Lectura: pública — la app necesita los multiplicadores para mostrar/calcular
--          los puntos de eliminatoria (la lee directo con la anon key).
-- Escritura: solo admins (directo o vía el RPC admin_set_knockout_multiplier).
-- ============================================================

ALTER TABLE knockout_multipliers ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede LEER los multiplicadores
DROP POLICY IF EXISTS "Anyone reads knockout multipliers" ON knockout_multipliers;
CREATE POLICY "Anyone reads knockout multipliers" ON knockout_multipliers
  FOR SELECT USING (true);

-- Solo admins pueden CREAR/EDITAR/BORRAR
DROP POLICY IF EXISTS "Admins manage knockout multipliers" ON knockout_multipliers;
CREATE POLICY "Admins manage knockout multipliers" ON knockout_multipliers
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

GRANT SELECT ON knockout_multipliers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON knockout_multipliers TO authenticated;
