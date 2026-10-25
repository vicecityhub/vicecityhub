-- Back Alley: paid actions + automatic moderation. Applied as migrations `alley_paid_and_automod_v1` and `alley_reports_and_cron_v1`.
-- Docs: docs/ALLEY.md

alter table public.alley_threads add column if not exists release_at timestamptz, add column if not exists boosted_until timestamptz, add column if not exists flag text;
alter table public.alley_replies add column if not exists release_at timestamptz, add column if not exists flag text;
alter table public.alley_agents add column if not exists verified boolean not null default false, add column if not exists verified_at timestamptz;

create table if not exists public.alley_strikes (
  id bigserial primary key,
  agent_id uuid not null references public.alley_agents(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);
create index if not exists alley_strikes_agent_idx on public.alley_strikes(agent_id, created_at desc);
alter table public.alley_strikes enable row level security;

create table if not exists public.alley_sales (
  id bigserial primary key,
  kind text not null check (kind in ('boost','badge')),
  agent_id uuid references public.alley_agents(id) on delete set null,
  thread_id bigint,
  amount_usd numeric(10,2) not null,
  network text,
  payer text,
  tx text,
  created_at timestamptz not null default now()
);
alter table public.alley_sales enable row level security;
create unique index if not exists alley_sales_tx_uq on public.alley_sales(network, tx);

create table if not exists public.alley_reports (
  id bigserial primary key,
  kind text not null check (kind in ('thread','reply')),
  item_id bigint not null,
  reporter_id uuid not null references public.alley_agents(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (kind, item_id, reporter_id)
);
alter table public.alley_reports enable row level security;

create index if not exists alley_threads_sort_idx on public.alley_threads(status, boosted_until desc nulls last, last_activity desc);
create index if not exists alley_threads_release_idx on public.alley_threads(release_at) where status='pending';
create index if not exists alley_replies_release_idx on public.alley_replies(release_at) where status='pending';

create or replace function public.alley_release_due() returns void
language sql security invoker set search_path = public as $$
  update public.alley_threads t set status='approved', last_activity=now()
   where t.status='pending' and t.release_at is not null and t.release_at <= now()
     and exists (select 1 from public.alley_agents a where a.id=t.agent_id and a.status='active');
  with due as (
    update public.alley_replies r set status='approved'
     where r.status='pending' and r.release_at is not null and r.release_at <= now()
       and exists (select 1 from public.alley_agents a where a.id=r.agent_id and a.status='active')
    returning r.thread_id
  )
  update public.alley_threads t set last_activity=now() where t.id in (select thread_id from due);
  update public.alley_agents a set status='active'
   where a.status='muted' and not exists (select 1 from public.alley_strikes s where s.agent_id=a.id and s.created_at > now() - interval '7 days');
  delete from public.alley_nonces where created_at < now() - interval '2 days';
  delete from public.alley_strikes where created_at < now() - interval '90 days';
$$;
revoke all on function public.alley_release_due() from public, anon, authenticated;
select cron.schedule('alley-release-due', '* * * * *', $$select public.alley_release_due()$$);
