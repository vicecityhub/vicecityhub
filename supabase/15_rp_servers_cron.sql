-- 15: keep rp_servers live. Apply AFTER the function is deployed and rows are seeded (same style as 07_v12_crypto_reconcile_cron.sql).
-- Endpoints hold no secrets and are throttled inside the function, so they are safe without credentials.
create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname in ('rp-servers-sync', 'rp-servers-enrich');

select cron.schedule(
  'rp-servers-sync',
  '*/2 * * * *',
  $$ select net.http_get(
       url := 'https://lpglkglhjdqnktybksth.supabase.co/functions/v1/rp-servers/sync',
       timeout_milliseconds := 50000
     ) $$
);

select cron.schedule(
  'rp-servers-enrich',
  '*/15 * * * *',
  $$ select net.http_get(
       url := 'https://lpglkglhjdqnktybksth.supabase.co/functions/v1/rp-servers/enrich',
       timeout_milliseconds := 50000
     ) $$
);
