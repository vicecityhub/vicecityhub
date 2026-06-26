-- =====================================================================
-- ADD media_type column to feed_posts
-- =====================================================================
-- feed_posts already has media_url (added in the original migration),
-- but no way to tell an image apart from a video. This adds that.
--
-- How to use: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- =====================================================================

alter table public.feed_posts
  add column if not exists media_type text check (media_type in ('image','video'));
