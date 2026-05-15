-- ============================================================
-- Actualización del sistema de puntos - Quiniela Mundial 2026
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

-- 1. Nueva función de puntos por partido
-- Resultado correcto (ganador/empate): 3 pts
-- Marcador exacto (adicional):          2 pts
-- Goles atinados de un equipo:          1 pt
-- Diferencia de goles correcta:         1 pt
-- Máximo por partido:                   7 pts

CREATE OR REPLACE FUNCTION calculate_points(
  pred_home INT, pred_away INT,
  real_home INT, real_away INT
) RETURNS INT AS $$
DECLARE pts INT := 0; BEGIN
  IF real_home IS NULL OR real_away IS NULL THEN RETURN NULL; END IF;
  -- Resultado correcto: 3 pts
  IF (pred_home > pred_away AND real_home > real_away) OR
     (pred_home < pred_away AND real_home < real_away) OR
     (pred_home = pred_away AND real_home = real_away)
  THEN pts := pts + 3; END IF;
  -- Marcador exacto: +2 pts
  IF pred_home = real_home AND pred_away = real_away THEN pts := pts + 2; END IF;
  -- Un equipo con goles correctos: +1 pt
  IF pred_home = real_home OR pred_away = real_away THEN pts := pts + 1; END IF;
  -- Diferencia de goles correcta: +1 pt
  IF (pred_home - pred_away) = (real_home - real_away) THEN pts := pts + 1; END IF;
  RETURN pts;
END; $$ LANGUAGE plpgsql;

-- 2. Tabla de predicciones del podio
CREATE TABLE IF NOT EXISTS podium_predictions (
  user_id    UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  champion   TEXT NOT NULL,
  runner_up  TEXT NOT NULL,
  third_place TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE podium_predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own podium" ON podium_predictions;
CREATE POLICY "Own podium" ON podium_predictions FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins see all podiums" ON podium_predictions;
CREATE POLICY "Admins see all podiums" ON podium_predictions FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- 3. Tabla de resultados reales del torneo (admin la llena al final)
CREATE TABLE IF NOT EXISTS tournament_results (
  id          INT PRIMARY KEY DEFAULT 1,
  champion    TEXT,
  runner_up   TEXT,
  third_place TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tournament_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads results" ON tournament_results;
CREATE POLICY "Anyone reads results" ON tournament_results FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage results" ON tournament_results;
CREATE POLICY "Admins manage results" ON tournament_results FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

INSERT INTO tournament_results (id) VALUES (1) ON CONFLICT DO NOTHING;

-- 4. Vista de standings actualizada (partidos + podio)
DROP VIEW IF EXISTS standings;
CREATE VIEW standings AS
SELECT
  p.id          AS user_id,
  p.name,
  COALESCE(mp.match_points, 0)                                       AS match_points,
  COALESCE(pp_pts.podium_points, 0)                                  AS podium_points,
  COALESCE(mp.match_points, 0) + COALESCE(pp_pts.podium_points, 0)  AS total_points,
  COALESCE(mp.predictions_count, 0)                                  AS predictions_count
FROM profiles p
LEFT JOIN (
  SELECT user_id, COALESCE(SUM(points), 0) AS match_points, COUNT(*) AS predictions_count
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
) pp_pts ON pp_pts.user_id = p.id;
