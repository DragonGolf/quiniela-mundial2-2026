// Run: node apply_sql.js
// Applies the scoring update SQL to Supabase

const SUPABASE_URL = 'https://nagbhtoajhmitbvtkxqb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hZ2JodG9hamhtaXRidnRreHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUzNjQzMywiZXhwIjoyMDk0MTEyNDMzfQ.2iquaxJmp9ChTu_txRkrsqmFVJHx5ljw07-T0MYijTU';

const statements = [
  // 1. New scoring function
  `CREATE OR REPLACE FUNCTION calculate_points(pred_home INT, pred_away INT, real_home INT, real_away INT) RETURNS INT AS $$ DECLARE pts INT := 0; BEGIN IF real_home IS NULL OR real_away IS NULL THEN RETURN NULL; END IF; IF (pred_home > pred_away AND real_home > real_away) OR (pred_home < pred_away AND real_home < real_away) OR (pred_home = pred_away AND real_home = real_away) THEN pts := pts + 3; END IF; IF pred_home = real_home AND pred_away = real_away THEN pts := pts + 2; END IF; IF pred_home = real_home OR pred_away = real_away THEN pts := pts + 1; END IF; IF (pred_home - pred_away) = (real_home - real_away) THEN pts := pts + 1; END IF; RETURN pts; END; $$ LANGUAGE plpgsql`,

  // 2. Podium predictions table
  `CREATE TABLE IF NOT EXISTS podium_predictions (user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE, champion TEXT NOT NULL, runner_up TEXT NOT NULL, third_place TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,

  `ALTER TABLE podium_predictions ENABLE ROW LEVEL SECURITY`,

  `DROP POLICY IF EXISTS "Own podium" ON podium_predictions`,
  `CREATE POLICY "Own podium" ON podium_predictions FOR ALL USING (auth.uid() = user_id)`,

  `DROP POLICY IF EXISTS "Admins see all podiums" ON podium_predictions`,
  `CREATE POLICY "Admins see all podiums" ON podium_predictions FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))`,

  // 3. Tournament results table
  `CREATE TABLE IF NOT EXISTS tournament_results (id INT PRIMARY KEY DEFAULT 1, champion TEXT, runner_up TEXT, third_place TEXT, updated_at TIMESTAMPTZ DEFAULT NOW())`,

  `ALTER TABLE tournament_results ENABLE ROW LEVEL SECURITY`,

  `DROP POLICY IF EXISTS "Anyone reads results" ON tournament_results`,
  `CREATE POLICY "Anyone reads results" ON tournament_results FOR SELECT USING (true)`,

  `DROP POLICY IF EXISTS "Admins manage results" ON tournament_results`,
  `CREATE POLICY "Admins manage results" ON tournament_results FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))`,

  `INSERT INTO tournament_results (id) VALUES (1) ON CONFLICT DO NOTHING`,

  // 4. Updated standings view
  `DROP VIEW IF EXISTS standings`,
  `CREATE VIEW standings AS SELECT p.id AS user_id, p.name, COALESCE(mp.match_points, 0) AS match_points, COALESCE(pp_pts.podium_points, 0) AS podium_points, COALESCE(mp.match_points, 0) + COALESCE(pp_pts.podium_points, 0) AS total_points, COALESCE(mp.predictions_count, 0) AS predictions_count FROM profiles p LEFT JOIN (SELECT user_id, COALESCE(SUM(points), 0) AS match_points, COUNT(*) AS predictions_count FROM predictions WHERE points IS NOT NULL GROUP BY user_id) mp ON mp.user_id = p.id LEFT JOIN (SELECT pp.user_id, CASE WHEN tr.champion IS NOT NULL AND pp.champion = tr.champion THEN 18 ELSE 0 END + CASE WHEN tr.runner_up IS NOT NULL AND pp.runner_up = tr.runner_up THEN 15 ELSE 0 END + CASE WHEN tr.third_place IS NOT NULL AND pp.third_place = tr.third_place THEN 8 ELSE 0 END AS podium_points FROM podium_predictions pp CROSS JOIN (SELECT * FROM tournament_results WHERE id = 1) tr) pp_pts ON pp_pts.user_id = p.id`,
];

async function runSQL(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_raw_sql`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql }),
  });
  return res;
}

// Use Supabase Management API
async function runViaManagementAPI(sql) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/nagbhtoajhmitbvtkxqb/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  const text = await res.text();
  return { status: res.status, body: text };
}

async function main() {
  console.log(`🔧 Aplicando ${statements.length} cambios a la base de datos...\n`);
  let ok = 0, fail = 0;
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 60).replace(/\s+/g, ' ');
    process.stdout.write(`[${i+1}/${statements.length}] ${preview}... `);
    const { status, body } = await runViaManagementAPI(stmt);
    if (status === 200 || status === 201 || status === 204) {
      console.log('✅');
      ok++;
    } else {
      console.log(`❌ (${status})`);
      const parsed = JSON.parse(body);
      console.log(`   Error: ${parsed?.message || body.substring(0, 200)}`);
      fail++;
    }
  }
  console.log(`\n✅ ${ok} exitosos · ❌ ${fail} fallidos`);
  if (fail === 0) console.log('🎉 ¡Todo listo! Ya puedes recargar la app.');
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
