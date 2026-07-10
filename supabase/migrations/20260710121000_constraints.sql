-- Phase 1.4 — Data-integrity constraints for guest-supplied content.
--
-- All guest tables previously accepted arbitrary text of unbounded length and
-- unvalidated enums/urls. These constraints cap abuse (huge payloads, junk
-- enum values, spoofed non-UUID ids) at the database boundary, which is the
-- only spam/DoS brake available (PostgREST has no per-key rate limiting).
--
-- Tables are empty (pre-launch) so constraints validate instantly.

-- event_id must always be present (RLS + FKs rely on it).
alter table public.rsvps              alter column event_id set not null;
alter table public.blessings          alter column event_id set not null;
alter table public.photos             alter column event_id set not null;
alter table public.dating_profiles    alter column event_id set not null;
alter table public.dating_messages    alter column event_id set not null;
alter table public.dating_likes       alter column event_id set not null;
alter table public.icebreaker_profiles alter column event_id set not null;
alter table public.icebreaker_missions alter column event_id set not null;
alter table public.icebreaker_matches  alter column event_id set not null;
alter table public.rideshares         alter column event_id set not null;
alter table public.reports            alter column event_id set not null;
alter table public.seating            alter column event_id set not null;

-- rsvps
alter table public.rsvps
  add constraint rsvps_guest_name_len check (char_length(guest_name) between 1 and 100),
  add constraint rsvps_submitter_name_len check (char_length(submitter_name) between 1 and 100),
  add constraint rsvps_phone_fmt check (submitter_phone ~ '^[0-9+\-\s]{7,15}$'),
  add constraint rsvps_allergens_len check (allergens is null or array_length(allergens, 1) is null or array_length(allergens, 1) <= 10);

-- blessings
alter table public.blessings
  add constraint blessings_name_len check (char_length(guest_name) between 1 and 100),
  add constraint blessings_message_len check (char_length(message) between 1 and 1000);

-- photos
alter table public.photos
  add constraint photos_guest_id_uuid check (public.is_valid_uuidv4(guest_id)),
  add constraint photos_name_len check (guest_name is null or char_length(guest_name) <= 100),
  add constraint photos_url_prefix check (image_url like 'https://eihsjrfncqhbmseldren.supabase.co/storage/v1/object/public/%');

-- dating_profiles
alter table public.dating_profiles
  add constraint dating_profiles_guest_id_uuid check (public.is_valid_uuidv4(guest_id)),
  add constraint dating_profiles_name_len check (char_length(name) between 1 and 100),
  add constraint dating_profiles_bio_len check (bio is null or char_length(bio) <= 500),
  add constraint dating_profiles_location_len check (location is null or char_length(location) <= 200),
  add constraint dating_profiles_connection_len check (connection is null or char_length(connection) <= 200),
  add constraint dating_profiles_age_range check (age is null or age between 18 and 99),
  add constraint dating_profiles_url check (photo_url is null or photo_url = '' or photo_url like 'https://eihsjrfncqhbmseldren.supabase.co/storage/v1/object/public/%');

-- dating_messages
alter table public.dating_messages
  add constraint dating_messages_sender_uuid check (public.is_valid_uuidv4(sender_id)),
  add constraint dating_messages_receiver_uuid check (public.is_valid_uuidv4(receiver_id)),
  add constraint dating_messages_len check (char_length(message) between 1 and 1000);

-- dating_likes
alter table public.dating_likes
  add constraint dating_likes_from_uuid check (public.is_valid_uuidv4(from_guest_id)),
  add constraint dating_likes_to_uuid check (public.is_valid_uuidv4(to_guest_id));

-- icebreaker_profiles
alter table public.icebreaker_profiles
  add constraint icebreaker_profiles_guest_id_uuid check (public.is_valid_uuidv4(guest_id)),
  add constraint icebreaker_profiles_name_len check (char_length(name) between 1 and 100),
  add constraint icebreaker_profiles_url check (photo_url is null or photo_url = '' or photo_url like 'https://eihsjrfncqhbmseldren.supabase.co/storage/v1/object/public/%');

-- icebreaker_missions
alter table public.icebreaker_missions
  add constraint icebreaker_missions_content_len check (char_length(content) between 1 and 500);

-- icebreaker_matches
alter table public.icebreaker_matches
  add constraint icebreaker_matches_g1_uuid check (public.is_valid_uuidv4(guest1_id)),
  add constraint icebreaker_matches_g2_uuid check (public.is_valid_uuidv4(guest2_id)),
  add constraint icebreaker_matches_status check (status in ('pending','completed')),
  add constraint icebreaker_matches_url check (photo_url is null or photo_url = '' or photo_url like 'https://eihsjrfncqhbmseldren.supabase.co/storage/v1/object/public/%');

-- rideshares
alter table public.rideshares
  add constraint rideshares_guest_id_uuid check (public.is_valid_uuidv4(guest_id)),
  add constraint rideshares_name_len check (char_length(guest_name) between 1 and 100),
  add constraint rideshares_phone_fmt check (phone ~ '^[0-9+\-\s]{7,15}$'),
  add constraint rideshares_role check (role in ('driver','seeker')),
  add constraint rideshares_direction check (direction in ('there','back','both')),
  add constraint rideshares_from_len check (from_location is null or char_length(from_location) <= 200),
  add constraint rideshares_to_len check (to_location is null or char_length(to_location) <= 200);

-- reports
alter table public.reports
  add constraint reports_reporter_uuid check (public.is_valid_uuidv4(reporter_id)),
  add constraint reports_item_type check (item_type in ('dating_profile','photo','icebreaker')),
  add constraint reports_status check (status in ('pending','reviewed','dismissed'));

-- seating
alter table public.seating
  add constraint seating_name_len check (char_length(guest_name) between 1 and 100),
  add constraint seating_table_len check (char_length(table_number) between 1 and 50);
