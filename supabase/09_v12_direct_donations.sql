-- x402 / direct donations ledger (applied as migration v12_direct_donations)
create table if not exists public.agent_direct_donations (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  source text not null default 'x402',
  network text not null,
  tx_hash text not null,
  payer text,
  asset text,
  amount_usd numeric(14,6) not null check (amount_usd > 0),
  meta jsonb not null default '{}'::jsonb,
  unique (network, tx_hash)
);
alter table public.agent_direct_donations enable row level security;
revoke all on public.agent_direct_donations from anon, authenticated;
