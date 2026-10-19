-- v12 automatic crypto settlement (applied to project lpglkglhjdqnktybksth as migration "v12_crypto_reconcile_cron")
-- Every minute the agent-api reconciler finds incoming stablecoin transfers by their unique amount tag, verifies them
-- on-chain (wallet, token, exact amount, newer than the order, finality), marks the order paid and, for merch,
-- creates the Printful order. The endpoint holds no secrets and is globally throttled, so it is safe without credentials.
create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname = 'vch-agent-reconcile';

select cron.schedule(
  'vch-agent-reconcile',
  '* * * * *',
  $$ select net.http_get(
       url := 'https://lpglkglhjdqnktybksth.supabase.co/functions/v1/agent-api/v1/internal/reconcile',
       timeout_milliseconds := 50000
     ) $$
);
