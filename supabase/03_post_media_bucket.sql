-- =====================================================================
-- STORAGE BUCKET: post-media (for images/video attached to feed_posts)
-- =====================================================================
-- STEP 1 (manual, in Dashboard): Storage -> New Bucket
--   Name: post-media
--   Public bucket: ON
--   (public, same logic as player-media — these are screenshots/clips
--    meant to be seen by everyone browsing the Community feed)
--
-- STEP 2: run this SQL in SQL Editor after creating the bucket above.
-- =====================================================================

create policy "post_media_public_read"
  on storage.objects for select
  using (bucket_id = 'post-media');

create policy "post_media_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "post_media_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Recommended path structure:
--   post-media/{user_id}/{timestamp}-{filename}.webp
