-- Supabase-only (pg_cron): nightly maintenance at 03:30 IST (22:00 UTC).
-- Deletes photo files nothing uses any more, and old error logs / sent notifications.
-- (Not part of the local SQL tests, which run on plain Postgres.)
select cron.schedule(
  'swap-maintenance',
  '0 22 * * *',
  $$ select net.http_post(
       url := 'https://vwkaohiukqmotwesdqvi.supabase.co/functions/v1/maintenance',
       body := '{}'::jsonb,
       headers := '{"Content-Type": "application/json"}'::jsonb,
       timeout_milliseconds := 60000) $$
);
