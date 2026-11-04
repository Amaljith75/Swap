-- Supabase-only: background HTTP calls and the release check schedule.
-- (Not part of the local SQL tests, which run on plain Postgres.)
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- Every 15 minutes: look for a newer APK on GitHub Releases and, if there is
-- one, record it and tell everyone (see the release-check Edge Function).
select cron.schedule(
  'swap-release-check',
  '*/15 * * * *',
  $$ select net.http_post(
       url := 'https://vwkaohiukqmotwesdqvi.supabase.co/functions/v1/release-check',
       body := '{}'::jsonb,
       headers := '{"Content-Type": "application/json"}'::jsonb) $$
);

-- Retry anything that got stuck in the queue (e.g. the function was cold or down).
select cron.schedule(
  'swap-notify-retry',
  '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://vwkaohiukqmotwesdqvi.supabase.co/functions/v1/notify',
       body := '{"retry": true}'::jsonb,
       headers := '{"Content-Type": "application/json"}'::jsonb) $$
);
