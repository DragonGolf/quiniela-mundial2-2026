-- ============================================================
-- RPC de la ventana "Ver predicciones" (LivePredictionsModal)
-- Privacidad: las predicciones AJENAS solo se devuelven si el partido
-- ya "cerró" (en vivo/terminado, o faltan menos de 15 min). Las propias
-- siempre. A prueba de trampa: el servidor no entrega lo ajeno antes de tiempo.
-- ============================================================
CREATE OR REPLACE FUNCTION get_match_predictions(p_match_id int)
RETURNS TABLE(
  league_id uuid, league_name text, member_id uuid, alias text,
  is_mine boolean, pred_home int, pred_away int
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_uid uuid := auth.uid(); v_revealed boolean;
BEGIN
  SELECT (status <> 'upcoming' OR match_date <= now() + interval '15 minutes')
    INTO v_revealed FROM matches WHERE id = p_match_id;
  RETURN QUERY
  SELECT l.id, l.name, lm.id, lm.alias,
    (lm.user_id = v_uid) AS is_mine, lp.pred_home, lp.pred_away
  FROM league_members lm
  JOIN leagues l ON l.id = lm.league_id
  JOIN league_predictions lp ON lp.league_member_id = lm.id AND lp.match_id = p_match_id
  WHERE lm.league_id IN (SELECT DISTINCT x.league_id FROM league_members x WHERE x.user_id = v_uid)
    AND (COALESCE(v_revealed, false) OR lm.user_id = v_uid);  -- ajenas solo si ya cerró
END;
$$;
GRANT EXECUTE ON FUNCTION get_match_predictions(int) TO authenticated;
