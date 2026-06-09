-- ============================================================
-- RPCs para la pantalla de Registro (transparencia por liga)
-- Cada función verifica que quien llama pertenece a la liga.
-- SECURITY DEFINER para poder leer predicciones de otros miembros.
-- ============================================================

-- 1. Miembros de la liga + avance de predicciones
CREATE OR REPLACE FUNCTION get_registro_members(p_league_id uuid)
RETURNS TABLE(
  member_id uuid, alias text, is_paid boolean, is_admin boolean,
  match_count bigint, has_groups boolean, has_podio boolean
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM league_members WHERE league_id = p_league_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  RETURN QUERY
  SELECT lm.id, lm.alias, lm.is_paid, lm.is_admin,
    (SELECT COUNT(*) FROM league_predictions lp WHERE lp.league_member_id = lm.id),
    EXISTS (SELECT 1 FROM member_group_predictions g WHERE g.league_member_id = lm.id),
    EXISTS (SELECT 1 FROM member_podium_predictions p WHERE p.league_member_id = lm.id)
  FROM league_members lm
  WHERE lm.league_id = p_league_id
  ORDER BY lm.alias;
END; $$;
GRANT EXECUTE ON FUNCTION get_registro_members(uuid) TO authenticated;

-- 2. Podio de todas las quinielas de la liga
CREATE OR REPLACE FUNCTION get_registro_podium(p_league_id uuid)
RETURNS TABLE(member_id uuid, champion text, runner_up text, third_place text, top_scorer text)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM league_members WHERE league_id = p_league_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  RETURN QUERY
  SELECT pp.league_member_id, pp.champion, pp.runner_up, pp.third_place, pp.top_scorer
  FROM member_podium_predictions pp
  JOIN league_members lm ON lm.id = pp.league_member_id
  WHERE lm.league_id = p_league_id;
END; $$;
GRANT EXECUTE ON FUNCTION get_registro_podium(uuid) TO authenticated;

-- 3. Grupos de todas las quinielas de la liga
CREATE OR REPLACE FUNCTION get_registro_groups(p_league_id uuid)
RETURNS TABLE(member_id uuid, group_name text, first_place text, second_place text)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM league_members WHERE league_id = p_league_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  RETURN QUERY
  SELECT g.league_member_id, g.group_name, g.first_place, g.second_place
  FROM member_group_predictions g
  JOIN league_members lm ON lm.id = g.league_member_id
  WHERE lm.league_id = p_league_id;
END; $$;
GRANT EXECUTE ON FUNCTION get_registro_groups(uuid) TO authenticated;

-- 4. Predicciones de partidos de todas las quinielas de la liga
CREATE OR REPLACE FUNCTION get_registro_matches(p_league_id uuid)
RETURNS TABLE(member_id uuid, match_id int, pred_home int, pred_away int)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM league_members WHERE league_id = p_league_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  RETURN QUERY
  SELECT lp.league_member_id, lp.match_id, lp.pred_home, lp.pred_away
  FROM league_predictions lp
  JOIN league_members lm ON lm.id = lp.league_member_id
  WHERE lm.league_id = p_league_id;
END; $$;
GRANT EXECUTE ON FUNCTION get_registro_matches(uuid) TO authenticated;
