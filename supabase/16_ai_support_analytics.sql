-- Vice City Hub AI Support & Real-Time Query Analytics
-- Stores anonymized user queries, Gemini triage classifications, UX pain points, and topic clusters.

create table if not exists public.ai_query_analytics (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  source text not null default 'widget',
  query text not null,
  language text not null default 'en',
  intent text not null default 'general_info',
  urgency text not null default 'low',
  sentiment text not null default 'neutral',
  hub_section text not null default 'index.html',
  topic_cluster text not null default 'General Hub Inquiry',
  pain_point text not null default 'None',
  suggested_action text not null default '',
  latency_ms integer not null default 0,
  page_path text
);

create index if not exists ai_query_analytics_created_idx
  on public.ai_query_analytics (created_at desc);

create index if not exists ai_query_analytics_sentiment_idx
  on public.ai_query_analytics (sentiment, created_at desc);

alter table public.ai_query_analytics enable row level security;

-- Lock down direct public writes; all reads/writes go through the ai-support Edge Function (service role).
revoke all on public.ai_query_analytics from anon, authenticated;
