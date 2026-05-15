-- ============================================================
-- Matching flexible de nombres - Quiniela Mundial 2026
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

-- 1. Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- similitud de texto (trigramas)
CREATE EXTENSION IF NOT EXISTS unaccent;   -- quitar tildes

-- 2. Función fuzzy_name_match
--    Retorna TRUE si pred y real_val se refieren claramente a la misma
--    persona o equipo, tolerando:
--      - Tildes/acentos (Mbappé = Mbappe)
--      - Mayúsculas/minúsculas
--      - Solo nombre o solo apellido (Kane = Harry Kane)
--      - Faltas de ortografía leves (Argentna = Argentina, Crirstiano = Cristiano)
CREATE OR REPLACE FUNCTION fuzzy_name_match(pred TEXT, real_val TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  p      TEXT;
  r      TEXT;
  r_words TEXT[];
  p_words TEXT[];
  w       TEXT;
BEGIN
  -- NULL o vacío → no coincide
  IF pred IS NULL OR real_val IS NULL
     OR trim(pred) = '' OR trim(real_val) = '' THEN
    RETURN FALSE;
  END IF;

  -- Normalizar: sin tildes, minúsculas, sin espacios extras
  p := trim(lower(unaccent(pred)));
  r := trim(lower(unaccent(real_val)));

  -- A) Coincidencia exacta normalizada
  IF p = r THEN RETURN TRUE; END IF;

  -- B) Similitud de trigramas >= 0.45
  --    (tolera ~2-3 letras incorrectas en nombres medios)
  IF similarity(p, r) >= 0.45 THEN RETURN TRUE; END IF;

  -- C) Alguna palabra significativa del nombre REAL aparece en la predicción
  --    Cubre: "Yamal" → "Lamine Yamal"  |  "Kane" → "Harry Kane"
  r_words := string_to_array(r, ' ');
  FOREACH w IN ARRAY r_words LOOP
    IF length(w) >= 3 THEN
      IF p LIKE '%' || w || '%' THEN RETURN TRUE; END IF;
      -- También tolera typo en esa sola palabra
      IF similarity(p, w) >= 0.65 THEN RETURN TRUE; END IF;
    END IF;
  END LOOP;

  -- D) Alguna palabra significativa de la PREDICCIÓN aparece en el nombre real
  --    Cubre: "Mbappe" → "Kylian Mbappé"
  p_words := string_to_array(p, ' ');
  FOREACH w IN ARRAY p_words LOOP
    IF length(w) >= 3 THEN
      IF r LIKE '%' || w || '%' THEN RETURN TRUE; END IF;
      IF similarity(r, w) >= 0.65 THEN RETURN TRUE; END IF;
    END IF;
  END LOOP;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- 3. Vista standings (predicciones legacy por user_id)
-- ============================================================
DROP VIEW IF EXISTS standings;
CREATE VIEW standings AS
SELECT
  p.id AS user_id,
  p.name,
  p.is_paid,
  COALESCE(mp.match_points,   0) AS match_points,
  COALESCE(pp_pts.podium_points, 0) AS podium_points,
  COALESCE(gp_pts.group_points,  0) AS group_points,
  COALESCE(ts_pts.scorer_points, 0) AS scorer_points,
  COALESCE(mp.match_points,  0)
    + COALESCE(pp_pts.podium_points, 0)
    + COALESCE(gp_pts.group_points,  0)
    + COALESCE(ts_pts.scorer_points, 0) AS total_points,
  COALESCE(mp.predictions_count, 0) AS predictions_count
FROM profiles p
LEFT JOIN (
  SELECT user_id, COALESCE(SUM(points), 0) AS match_points, COUNT(*) AS predictions_count
  FROM predictions WHERE points IS NOT NULL GROUP BY user_id
) mp ON mp.user_id = p.id
LEFT JOIN (
  SELECT pp.user_id,
    CASE WHEN tr.champion    IS NOT NULL AND fuzzy_name_match(pp.champion,    tr.champion)    THEN 18 ELSE 0 END +
    CASE WHEN tr.runner_up   IS NOT NULL AND fuzzy_name_match(pp.runner_up,   tr.runner_up)   THEN 15 ELSE 0 END +
    CASE WHEN tr.third_place IS NOT NULL AND fuzzy_name_match(pp.third_place, tr.third_place) THEN  8 ELSE 0 END
    AS podium_points
  FROM podium_predictions pp
  CROSS JOIN (SELECT * FROM tournament_results WHERE id = 1) tr
) pp_pts ON pp_pts.user_id = p.id
LEFT JOIN (
  SELECT gp.user_id,
    COALESCE(SUM(
      CASE WHEN gr.first_place  IS NOT NULL AND (gp.first_place  = gr.first_place  OR gp.first_place  = gr.second_place) THEN 4 ELSE 0 END +
      CASE WHEN gr.second_place IS NOT NULL AND (gp.second_place = gr.first_place  OR gp.second_place = gr.second_place) THEN 4 ELSE 0 END
    ), 0) AS group_points
  FROM group_predictions gp
  LEFT JOIN group_results gr ON gr.group_name = gp.group_name
  GROUP BY gp.user_id
) gp_pts ON gp_pts.user_id = p.id
LEFT JOIN (
  SELECT pp.user_id,
    CASE WHEN tr.top_scorer IS NOT NULL AND fuzzy_name_match(pp.top_scorer, tr.top_scorer) THEN 10 ELSE 0 END AS scorer_points
  FROM podium_predictions pp
  CROSS JOIN (SELECT * FROM tournament_results WHERE id = 1) tr
) ts_pts ON ts_pts.user_id = p.id;

-- ============================================================
-- 4. Vista league_standings (predicciones por league_member_id)
-- ============================================================
DROP VIEW IF EXISTS league_standings;
CREATE VIEW league_standings AS
SELECT
  lm.league_id,
  lm.id                             AS league_member_id,
  lm.user_id,
  lm.alias                          AS name,
  lm.is_paid,
  lm.is_admin,
  COALESCE(mp.match_points,    0)   AS match_points,
  COALESCE(pp_pts.podium_points, 0) AS podium_points,
  COALESCE(gp_pts.group_points,  0) AS group_points,
  COALESCE(ts_pts.scorer_points, 0) AS scorer_points,
  COALESCE(mp.match_points,  0)
    + COALESCE(pp_pts.podium_points, 0)
    + COALESCE(gp_pts.group_points,  0)
    + COALESCE(ts_pts.scorer_points, 0) AS total_points,
  COALESCE(mp.predictions_count, 0) AS predictions_count
FROM league_members lm
LEFT JOIN (
  SELECT league_member_id, COALESCE(SUM(points), 0) AS match_points, COUNT(*) AS predictions_count
  FROM league_predictions WHERE points IS NOT NULL GROUP BY league_member_id
) mp ON mp.league_member_id = lm.id
LEFT JOIN (
  SELECT pp.league_member_id,
    CASE WHEN tr.champion    IS NOT NULL AND fuzzy_name_match(pp.champion,    tr.champion)    THEN 18 ELSE 0 END +
    CASE WHEN tr.runner_up   IS NOT NULL AND fuzzy_name_match(pp.runner_up,   tr.runner_up)   THEN 15 ELSE 0 END +
    CASE WHEN tr.third_place IS NOT NULL AND fuzzy_name_match(pp.third_place, tr.third_place) THEN  8 ELSE 0 END
    AS podium_points
  FROM member_podium_predictions pp
  CROSS JOIN (SELECT * FROM tournament_results WHERE id = 1) tr
) pp_pts ON pp_pts.league_member_id = lm.id
LEFT JOIN (
  SELECT gp.league_member_id,
    COALESCE(SUM(
      CASE WHEN gr.first_place  IS NOT NULL AND (gp.first_place  = gr.first_place  OR gp.first_place  = gr.second_place) THEN 4 ELSE 0 END +
      CASE WHEN gr.second_place IS NOT NULL AND (gp.second_place = gr.first_place  OR gp.second_place = gr.second_place) THEN 4 ELSE 0 END
    ), 0) AS group_points
  FROM member_group_predictions gp
  LEFT JOIN group_results gr ON gr.group_name = gp.group_name
  GROUP BY gp.league_member_id
) gp_pts ON gp_pts.league_member_id = lm.id
LEFT JOIN (
  SELECT pp.league_member_id,
    CASE WHEN tr.top_scorer IS NOT NULL AND fuzzy_name_match(pp.top_scorer, tr.top_scorer) THEN 10 ELSE 0 END AS scorer_points
  FROM member_podium_predictions pp
  CROSS JOIN (SELECT * FROM tournament_results WHERE id = 1) tr
) ts_pts ON ts_pts.league_member_id = lm.id;

-- ============================================================
-- VERIFICACIÓN (opcional - para probar antes de terminar)
-- ============================================================
-- SELECT fuzzy_name_match('Argentina', 'Argentina');        -- TRUE
-- SELECT fuzzy_name_match('Argentna', 'Argentina');         -- TRUE (typo)
-- SELECT fuzzy_name_match('Argentna', 'Argentina');         -- TRUE
-- SELECT fuzzy_name_match('Mbappe', 'Kylian Mbappé');      -- TRUE (unaccent + apellido)
-- SELECT fuzzy_name_match('Kane', 'Harry Kane');            -- TRUE (solo apellido)
-- SELECT fuzzy_name_match('Lamine', 'Lamine Yamal');        -- TRUE (solo nombre)
-- SELECT fuzzy_name_match('Yamal', 'Lamine Yamal');         -- TRUE
-- SELECT fuzzy_name_match('Crirstiano', 'Cristiano Ronaldo'); -- TRUE (typo)
-- SELECT fuzzy_name_match('Francia', 'Argentina');          -- FALSE
-- SELECT fuzzy_name_match('Messi', 'Kylian Mbappé');        -- FALSE
