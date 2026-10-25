-- Highlights board: screenshots and short clips uploaded by signed-in players (built with PS5 captures in mind).
-- Applied as migration `highlights_v1`. Docs: docs/HIGHLIGHTS.md
-- Moderation is automatic: per-user daily cap, bucket-level mime/size limits, and peer reports (3 reporters whose accounts are
-- at least one day old hide an item). No human review.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('highlights', 'highlights', true, 52428800,
        array['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists highlights_obj_insert on storage.objects;
create policy highlights_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'highlights' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists highlights_obj_delete on storage.objects;
create policy highlights_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'highlights' and (storage.foldername(name))[1] = auth.uid()::text);

create table if not exists public.highlights (
  id bigint generated always as identity primary key,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text not null default '',
  kind text not null check (kind in ('image','video')),
  media_path text not null,
  poster_path text,
  title text not null check (char_length(title) between 3 and 80),
  game text not null default 'GTA' check (char_length(game) between 1 and 40),
  platform text not null default 'ps5' check (platform in ('ps5','ps4','xbox','pc','other')),
  status text not null default 'approved' check (status in ('approved','hidden')),
  likes integer not null default 0,
  created_at timestamptz not null default now(),
  constraint highlights_media_owner check (media_path like author_id::text || '/%'),
  constraint highlights_poster_owner check (poster_path is null or poster_path like author_id::text || '/%')
);
create index if not exists highlights_new_idx on public.highlights (status, created_at desc);
create index if not exists highlights_top_idx on public.highlights (status, likes desc, created_at desc);
alter table public.highlights enable row level security;
drop policy if exists highlights_read on public.highlights;
create policy highlights_read on public.highlights for select to anon, authenticated using (status = 'approved' or author_id = auth.uid());
drop policy if exists highlights_insert on public.highlights;
create policy highlights_insert on public.highlights for insert to authenticated with check (author_id = auth.uid());
drop policy if exists highlights_delete on public.highlights;
create policy highlights_delete on public.highlights for delete to authenticated using (author_id = auth.uid());

create table if not exists public.highlight_likes (
  highlight_id bigint not null references public.highlights(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (highlight_id, user_id)
);
alter table public.highlight_likes enable row level security;
drop policy if exists highlight_likes_own_read on public.highlight_likes;
create policy highlight_likes_own_read on public.highlight_likes for select to authenticated using (user_id = auth.uid());
drop policy if exists highlight_likes_own_insert on public.highlight_likes;
create policy highlight_likes_own_insert on public.highlight_likes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists highlight_likes_own_delete on public.highlight_likes;
create policy highlight_likes_own_delete on public.highlight_likes for delete to authenticated using (user_id = auth.uid());

create table if not exists public.highlight_reports (
  highlight_id bigint not null references public.highlights(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (highlight_id, user_id)
);
alter table public.highlight_reports enable row level security;
drop policy if exists highlight_reports_insert on public.highlight_reports;
create policy highlight_reports_insert on public.highlight_reports for insert to authenticated
  with check (user_id = auth.uid() and not exists (select 1 from public.highlights h where h.id = highlight_id and h.author_id = auth.uid()));
-- reports are write-only for users: no select policy

create or replace function public.highlights_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.highlights where author_id = new.author_id and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'daily_limit: at most 10 uploads per 24 hours';
  end if;
  new.author_name := coalesce(nullif((select display_name from public.player_profiles where user_id = new.author_id), ''),
                              'Player-' || substr(replace(new.author_id::text, '-', ''), 1, 4));
  new.status := 'approved';
  new.likes := 0;
  if new.kind = 'image' then new.poster_path := null; end if;
  return new;
end $$;
drop trigger if exists highlights_bi on public.highlights;
create trigger highlights_bi before insert on public.highlights for each row execute function public.highlights_before_insert();

create or replace function public.highlight_likes_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update public.highlights set likes = likes + 1 where id = new.highlight_id;
  else update public.highlights set likes = greatest(likes - 1, 0) where id = old.highlight_id; end if;
  return null;
end $$;
drop trigger if exists highlight_likes_ai on public.highlight_likes;
create trigger highlight_likes_ai after insert or delete on public.highlight_likes for each row execute function public.highlight_likes_count();

create or replace function public.highlight_reports_auto_hide() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  if (select count(*) from public.highlight_reports r join auth.users u on u.id = r.user_id
       where r.highlight_id = new.highlight_id and u.created_at < now() - interval '1 day') >= 3 then
    update public.highlights set status = 'hidden' where id = new.highlight_id;
  end if;
  return null;
end $$;
drop trigger if exists highlight_reports_ai on public.highlight_reports;
create trigger highlight_reports_ai after insert on public.highlight_reports for each row execute function public.highlight_reports_auto_hide();

revoke all on function public.highlights_before_insert(), public.highlight_likes_count(), public.highlight_reports_auto_hide() from public, anon, authenticated;

-- Device login (console code flow). Service role only (edge function `device-login`).
create table if not exists public.device_logins (
  id bigint generated always as identity primary key,
  code text not null unique,
  secret_hash text not null unique,
  ua text,
  user_id uuid,
  token_hash text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  approved_at timestamptz,
  consumed_at timestamptz
);
alter table public.device_logins enable row level security;
