-- Phase 1 verification follow-up: the single-column revoke in the RLS reset was
-- overridden by a table-level SELECT grant, so submitter_phone stayed readable
-- by anon. Drop the table grant and re-grant only the non-sensitive columns.
-- (The RLS reset migration now embeds the correct form for fresh replays; this
-- migration records the fix applied to the already-migrated project.)
revoke select on public.rsvps from anon;
grant select (id, event_id, group_id, submitter_name, guest_name, allergens, created_at)
  on public.rsvps to anon;
