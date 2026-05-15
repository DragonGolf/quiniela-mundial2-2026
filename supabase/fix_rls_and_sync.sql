-- ============================================================
-- 1. FIX: Allow admins to update is_paid on any profile
-- ============================================================
DROP POLICY IF EXISTS "admins_update_any_profile" ON profiles;

CREATE POLICY "admins_update_any_profile" ON profiles
FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- ============================================================
-- 2. Enable pg_net extension (needed for auto-sync cron)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================
-- 3. Enable pg_cron extension (needed for auto-sync cron)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================
-- 4. Auto-sync every 3 minutes (activo durante el torneo)
--    Llama al Edge Function sync-matches automáticamente
-- ============================================================
SELECT cron.schedule(
  'auto-sync-matches',
  '*/3 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nagbhtoajhmitbvtkxqb.supabase.co/functions/v1/sync-matches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hZ2JodG9hamhtaXRidnRreHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUzNjQzMywiZXhwIjoyMDk0MTEyNDMzfQ.2iquaxJmp9ChTu_txRkrsqmFVJHx5ljw07-T0MYijTU',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
