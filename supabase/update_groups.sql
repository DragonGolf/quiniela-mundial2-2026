-- ============================================================
-- Grupos + Goleador - Quiniela Mundial 2026
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

-- 1. Agregar goleador a predicciones del podio
ALTER TABLE podium_predictions ADD COLUMN IF NOT EXISTS top_scorer TEXT;

-- 2. Agregar goleador a resultados del torneo
ALTER TABLE tournament_results ADD COLUMN IF NOT EXISTS top_scorer TEXT;

-- 3. Predicciones de grupos por usuario
CREATE TABLE IF NOT EXISTS group_predictions (
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_name   TEXT NOT NULL,
  first_place  TEXT NOT NULL,
  second_place TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, group_name)
);
ALTER TABLE group_predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own group preds" ON group_predictions;
CREATE POLICY "Own group preds" ON group_predictions FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins group preds" ON group_predictions;
CREATE POLICY "Admins group preds" ON group_predictions FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- 4. Resultados reales de grupos (admin los ingresa)
CREATE TABLE IF NOT EXISTS group_results (
  group_name   TEXT PRIMARY KEY,
  first_place  TEXT,
  second_place TEXT,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE group_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads group results" ON group_results;
CREATE POLICY "Anyone reads group results" ON group_results FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage group results" ON group_results;
CREATE POLICY "Admins manage group results" ON group_results FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- 5. Vista de standings actualizada (partidos + podio + grupos + goleador)
DROP VIEW IF EXISTS standings;
CREATE VIEW standings AS
SELECT
  p.id AS user_id,
  p.name,
  COALESCE(mp.match_points,  0) AS match_points,
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
  SELECT user_id,
    COALESCE(SUM(points), 0) AS match_points,
    COUNT(*) AS predictions_count
  FROM predictions WHERE points IS NOT NULL GROUP BY user_id
) mp ON mp.user_id = p.id
LEFT JOIN (
  SELECT pp.user_id,
    CASE WHEN tr.champion    IS NOT NULL AND pp.champion    = tr.champion    THEN 18 ELSE 0 END +
    CASE WHEN tr.runner_up   IS NOT NULL AND pp.runner_up   = tr.runner_up   THEN 15 ELSE 0 END +
    CASE WHEN tr.third_place IS NOT NULL AND pp.third_place = tr.third_place THEN 8  ELSE 0 END
    AS podium_points
  FROM podium_predictions pp
  CROSS JOIN (SELECT * FROM tournament_results WHERE id = 1) tr
) pp_pts ON pp_pts.user_id = p.id
LEFT JOIN (
  -- 4 pts por cada equipo que el usuario puso en top-2 y realmente quedó en top-2
  SELECT gp.user_id,
    COALESCE(SUM(
      CASE WHEN gr.first_place  IS NOT NULL
           AND (gp.first_place  = gr.first_place OR gp.first_place  = gr.second_place)
           THEN 4 ELSE 0 END +
      CASE WHEN gr.second_place IS NOT NULL
           AND (gp.second_place = gr.first_place OR gp.second_place = gr.second_place)
           THEN 4 ELSE 0 END
    ), 0) AS group_points
  FROM group_predictions gp
  LEFT JOIN group_results gr ON gr.group_name = gp.group_name
  GROUP BY gp.user_id
) gp_pts ON gp_pts.user_id = p.id
LEFT JOIN (
  SELECT pp.user_id,
    CASE WHEN tr.top_scorer IS NOT NULL
         AND pp.top_scorer  IS NOT NULL
         AND LOWER(TRIM(pp.top_scorer)) = LOWER(TRIM(tr.top_scorer))
         THEN 10 ELSE 0 END AS scorer_points
  FROM podium_predictions pp
  CROSS JOIN (SELECT * FROM tournament_results WHERE id = 1) tr
) ts_pts ON ts_pts.user_id = p.id;
