-- Security-review follow-up (Phase 1).
--
-- 1) The event_assets_update / icebreaker_update policies allowed ANY anon to
--    overwrite ANY object in those buckets (object-level IDOR). No client path
--    overwrites objects — Photos uploads with upsert:false, Admin uploads have
--    no upsert, and the icebreaker/dating uploads use unique Date.now() file
--    names — so UPDATE is never needed. Drop both policies (INSERT stays).
drop policy if exists "event_assets_update" on storage.objects;
drop policy if exists "icebreaker_update" on storage.objects;

-- 2) blessings.is_approved defaults to true (auto-approve is the intended
--    product behaviour: admins moderate reactively via the Admin blessings
--    manager + reports). Prevent anon from forging the moderation flag so the
--    column DEFAULT always governs and a guest cannot self-approve/hide.
--    A table-level INSERT grant overrides a single-column revoke, so drop the
--    table grant and re-grant INSERT only on the guest-writable columns.
revoke insert on public.blessings from anon;
grant insert (event_id, guest_name, message, image_url) on public.blessings to anon;
