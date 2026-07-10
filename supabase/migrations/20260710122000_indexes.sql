-- Phase 1.5 — Indexes for event-scoped access at 500-1000 concurrent guests.
--
-- Every guest query filters by event_id, but only the profile tables had a
-- covering (composite) index. These add the missing event_id indexes and the
-- composites the chat/unread queries need, and replace the unused single-column
-- blessings index with one matching the approved-read query.

create index if not exists rsvps_event_id_idx on public.rsvps (event_id);
create index if not exists rideshares_event_id_idx on public.rideshares (event_id);
create index if not exists photos_event_id_idx on public.photos (event_id);
create index if not exists reports_event_id_idx on public.reports (event_id);
create index if not exists seating_event_id_idx on public.seating (event_id);
create index if not exists icebreaker_missions_event_id_idx on public.icebreaker_missions (event_id);
create index if not exists icebreaker_matches_event_id_idx on public.icebreaker_matches (event_id);
create index if not exists dating_likes_event_id_idx on public.dating_likes (event_id);

-- Chat history (sender/receiver .or filter) and unread counts.
create index if not exists dating_messages_event_receiver_idx
  on public.dating_messages (event_id, receiver_id);
create index if not exists dating_messages_event_sender_idx
  on public.dating_messages (event_id, sender_id);

-- Approved-blessings read on Home; replaces the unused single-column index.
drop index if exists public.blessings_event_id_idx;
create index if not exists blessings_event_approved_idx
  on public.blessings (event_id, is_approved);
