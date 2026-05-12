-- ============================================================
-- QUINIELA MUNDIAL 2026 - Esquema de base de datos Supabase
-- Ejecuta este archivo completo en el SQL Editor de Supabase
-- ============================================================

-- Tabla de perfiles de usuario
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de partidos
CREATE TABLE matches (
  id SERIAL PRIMARY KEY,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_flag TEXT NOT NULL DEFAULT '🏴',
  away_flag TEXT NOT NULL DEFAULT '🏴',
  match_date TIMESTAMPTZ NOT NULL,
  stage TEXT NOT NULL DEFAULT 'group',
  group_name TEXT,
  venue TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'live', 'finished')),
  home_score INTEGER,
  away_score INTEGER,
  api_match_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de predicciones
CREATE TABLE predictions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
  pred_home INTEGER NOT NULL CHECK (pred_home >= 0),
  pred_away INTEGER NOT NULL CHECK (pred_away >= 0),
  points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, match_id)
);

-- ============================================================
-- FUNCIÓN: Calcular puntos de una predicción
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_points(
  p_pred_home INT, p_pred_away INT,
  p_real_home INT, p_real_away INT
) RETURNS INT AS $$
BEGIN
  IF p_pred_home = p_real_home AND p_pred_away = p_real_away THEN
    RETURN 3;
  END IF;
  IF (p_pred_home > p_pred_away AND p_real_home > p_real_away) OR
     (p_pred_home < p_pred_away AND p_real_home < p_real_away) OR
     (p_pred_home = p_pred_away AND p_real_home = p_real_away) THEN
    RETURN 1;
  END IF;
  RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCIÓN: Recalcular puntos cuando se actualiza un partido
-- ============================================================
CREATE OR REPLACE FUNCTION recalculate_match_points()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'finished' AND NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL THEN
    UPDATE predictions
    SET
      points = calculate_points(pred_home, pred_away, NEW.home_score, NEW.away_score),
      updated_at = NOW()
    WHERE match_id = NEW.id;
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_recalculate_points
  BEFORE UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_match_points();

-- ============================================================
-- VISTA: Standings (ranking)
-- ============================================================
CREATE OR REPLACE VIEW standings AS
SELECT
  p.user_id,
  pr.name,
  COALESCE(SUM(p.points), 0) AS total_points,
  COUNT(*) FILTER (WHERE p.points = 3) AS exact_scores,
  COUNT(*) FILTER (WHERE p.points = 1) AS correct_results,
  COUNT(*) AS predictions_count
FROM predictions p
JOIN profiles pr ON pr.id = p.user_id
JOIN matches m ON m.id = p.match_id
WHERE m.status = 'finished'
GROUP BY p.user_id, pr.name
ORDER BY total_points DESC, exact_scores DESC;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

-- Profiles: todos pueden leer, solo tú editas el tuyo
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Matches: todos pueden leer
CREATE POLICY "matches_select" ON matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "matches_admin_write" ON matches FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Predictions:
-- INSERT/UPDATE: solo cuando el partido es 'upcoming' y es tu predicción
CREATE POLICY "predictions_insert" ON predictions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM matches WHERE id = match_id AND status = 'upcoming')
  );

CREATE POLICY "predictions_update" ON predictions FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM matches WHERE id = match_id AND status = 'upcoming')
  );

-- SELECT: ves las tuyas siempre, las de otros solo cuando el partido ya empezó
CREATE POLICY "predictions_select_own" ON predictions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "predictions_select_others" ON predictions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM matches WHERE id = match_id AND status IN ('live', 'finished'))
  );

-- Service role puede hacer todo (para el Edge Function de sync)
CREATE POLICY "predictions_service_all" ON predictions FOR ALL TO service_role USING (true);
CREATE POLICY "matches_service_all" ON matches FOR ALL TO service_role USING (true);

-- ============================================================
-- DATOS DE PRUEBA: Algunos partidos del Mundial 2026
-- (Elimina esto cuando tengas datos reales de la API)
-- ============================================================
INSERT INTO matches (home_team, away_team, home_flag, away_flag, match_date, stage, group_name, venue, status) VALUES
('México', 'Ecuador', '🇲🇽', '🇪🇨', '2026-06-12 18:00:00-05', 'group', 'A', 'Estadio Azteca, CDMX', 'upcoming'),
('Estados Unidos', 'Canadá', '🇺🇸', '🇨🇦', '2026-06-13 20:00:00-05', 'group', 'B', 'MetLife Stadium, NJ', 'upcoming'),
('Argentina', 'Chile', '🇦🇷', '🇨🇱', '2026-06-14 18:00:00-05', 'group', 'C', 'Hard Rock Stadium, Miami', 'upcoming'),
('Brasil', 'Venezuela', '🇧🇷', '🇻🇪', '2026-06-15 16:00:00-05', 'group', 'D', 'AT&T Stadium, Dallas', 'upcoming'),
('España', 'Marruecos', '🇪🇸', '🇲🇦', '2026-06-16 20:00:00-05', 'group', 'E', 'SoFi Stadium, LA', 'upcoming'),
('Francia', 'Alemania', '🇫🇷', '🇩🇪', '2026-06-17 20:00:00-05', 'group', 'F', 'Levi''s Stadium, SF', 'upcoming');
