-- ============================================================
-- Política RLS para que un usuario pueda eliminar su propia quiniela
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

-- 1. Permitir que el usuario elimine su propia entrada en league_members
DROP POLICY IF EXISTS "users_can_delete_own_entry" ON league_members;
CREATE POLICY "users_can_delete_own_entry" ON league_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 2. Permitir eliminar sus propias predicciones de partidos (por si no hay CASCADE)
DROP POLICY IF EXISTS "users_can_delete_own_league_preds" ON league_predictions;
CREATE POLICY "users_can_delete_own_league_preds" ON league_predictions
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM league_members
      WHERE id = league_predictions.league_member_id
        AND user_id = auth.uid()
    )
  );

-- 3. Permitir eliminar predicciones de grupos propias
DROP POLICY IF EXISTS "users_can_delete_own_group_preds" ON member_group_predictions;
CREATE POLICY "users_can_delete_own_group_preds" ON member_group_predictions
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM league_members
      WHERE id = member_group_predictions.league_member_id
        AND user_id = auth.uid()
    )
  );

-- 4. Permitir eliminar predicciones de podio propias
DROP POLICY IF EXISTS "users_can_delete_own_podium_preds" ON member_podium_predictions;
CREATE POLICY "users_can_delete_own_podium_preds" ON member_podium_predictions
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM league_members
      WHERE id = member_podium_predictions.league_member_id
        AND user_id = auth.uid()
    )
  );
