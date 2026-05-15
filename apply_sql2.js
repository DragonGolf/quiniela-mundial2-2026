// Run: node apply_sql2.js
// Applies group predictions + top scorer updates to Supabase

const SUPABASE_URL = 'https://nagbhtoajhmitbvtkxqb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hZ2JodG9hamhtaXRidnRreHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUzNjQzMywiZXhwIjoyMDk0MTEyNDMzfQ.2iquaxJmp9ChTu_txRkrsqmFVJHx5ljw07-T0MYijTU';

async function supabase(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, body: text };
}

// Use pg via the Supabase connection string isn't available without password.
// Instead we apply DDL via the Supabase Management API (requires access token).
// Since we don't have a personal access token, we'll provide the SQL to paste manually.

const SQL = `
-- === PASTE THIS IN SUPABASE SQL EDITOR ===

-- 1. Add top_scorer to podium_predictions
ALTER TABLE podium_predictions ADD COLUMN IF NOT EXISTS top_scorer TEXT;

-- 2. Add top_scorer to tournament_results
ALTER TABLE tournament_results ADD COLUMN IF NOT EXISTS top_scorer TEXT;

-- 3. Group predictions table
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

-- 4. Group results table
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

-- 5. Updated standings view
DROP VIEW IF EXISTS standings;
CREATE VIEW standings AS
SELECT
  p.id AS user_id,
  p.name,
  COALESCE(mp.match_points,  0) AS match_points,
  COALESCE(pp_pts.podium_points, 0) AS podium_points,
  COALESCE(gp_pts.group_points,  0) AS group_points,
  COALESCE(ts_pts.scorer_points, 0) AS scorer_points,
  COALESCE(mp.match_points,  0) + COALESCE(pp_pts.podium_points, 0)
    + COALESCE(gp_pts.group_points, 0) + COALESCE(ts_pts.scorer_points, 0) AS total_points,
  COALESCE(mp.predictions_count, 0) AS predictions_count
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
    CASE WHEN tr.top_scorer IS NOT NULL AND pp.top_scorer IS NOT NULL
         AND LOWER(TRIM(pp.top_scorer)) = LOWER(TRIM(tr.top_scorer)) THEN 10 ELSE 0 END AS scorer_points
  FROM podium_predictions pp
  CROSS JOIN (SELECT * FROM tournament_results WHERE id = 1) tr
) ts_pts ON ts_pts.user_id = p.id;
`;

console.log('\n📋 Copia y pega este SQL en Supabase > SQL Editor > New query > Run:\n');
console.log('='.repeat(60));
console.log(SQL);
console.log('='.repeat(60));
console.log('\n✅ Una vez que lo corras en Supabase, recarga la app.');
