-- v12: shared cache for the Agent API (merch catalog snapshot + atomic refresh lease).
-- Already applied to project lpglkglhjdqnktybksth as migration "v12_agent_cache".
-- RLS is on with NO policies: only the service role (edge function) can read/write.
create table if not exists public.agent_cache (
  key text primary key,
  value jsonb not null,
  refresh_lock timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.agent_cache enable row level security;
comment on table public.agent_cache is 'v12 agent API shared cache (merch snapshot + refresh lock). RLS on, no policies: service role only.';
