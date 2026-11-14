-- Leonida FM (the site radio) builds its playlist by listing the public muz bucket:
-- POST /storage/v1/object/list/muz. Direct file URLs of a public bucket work without any policy, but the list
-- endpoint is filtered by RLS: with no SELECT policy it answers [] for anon, and the radio has no tracks.
-- Applied to the live project on 2026-11-13 (migration muz_public_read).
drop policy if exists "muz_public_read" on storage.objects;
create policy "muz_public_read" on storage.objects for select to public using (bucket_id = 'muz');
