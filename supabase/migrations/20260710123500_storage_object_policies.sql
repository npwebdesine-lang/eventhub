-- Phase 1.6b — Tighten storage.objects policies.
--
-- Remove the broad listing/SELECT policies (public buckets still serve objects
-- by their public URL without a SELECT policy) and replace the two "ALL" public
-- policies with upload-only policies, so anonymous guests can no longer list or
-- delete arbitrary files in the event-assets and icebreaker-uploads buckets.

drop policy if exists "Allow anyone to view blessings" on storage.objects;
drop policy if exists "Dating Profiles Public Access" on storage.objects;

drop policy if exists "Public Access Event Assets" on storage.objects;
create policy "event_assets_insert" on storage.objects
  for insert to public with check (bucket_id = 'event-assets');
create policy "event_assets_update" on storage.objects
  for update to public using (bucket_id = 'event-assets') with check (bucket_id = 'event-assets');

drop policy if exists "Public Access Icebreaker Uploads" on storage.objects;
create policy "icebreaker_insert" on storage.objects
  for insert to public with check (bucket_id = 'icebreaker-uploads');
create policy "icebreaker_update" on storage.objects
  for update to public using (bucket_id = 'icebreaker-uploads') with check (bucket_id = 'icebreaker-uploads');
