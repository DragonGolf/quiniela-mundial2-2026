-- Agregar campo is_paid a profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;

-- Actualizar standings para solo mostrar jugadores que han pagado
DROP VIEW IF EXISTS standings;
CREATE VIEW standings AS
SELECT
  p.id AS user_id,
  p.name,
  p.is_paid,
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
