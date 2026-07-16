-- RSVP & Guest Management module: turn the dead `event_guests` table into a
-- pre-loaded invitee list. Design spec (local, untracked per .gitignore):
-- docs/superpowers/specs/2026-07-16-rsvp-guest-management-design.md
--
-- The table existed with 0 rows and was referenced nowhere in src/ (along with its
-- register_guest() function), so it is reused rather than replaced. This module is
-- independent of the existing self-service `rsvps` flow at /invite/:id, which is
-- left untouched: rsvps answers "who is coming?", event_guests answers "did David
-- confirm?".

-- Two guests genuinely named "דוד כהן" is normal on a wedding list; the unique
-- constraint would reject the second one during import.
alter table public.event_guests
  drop constraint if exists event_guests_event_id_guest_name_key;

alter table public.event_guests
  add column if not exists phone text,
  add column if not exists status text not null default 'pending',
  add column if not exists guests_count integer not null default 1,
  add column if not exists notes text,
  add column if not exists responded_at timestamptz;  -- distinguishes a real reply from the default

-- Constraints mirror the conventions already used by rsvps/rideshares/photos.
-- guest_name is kept (not renamed to `name`) to match photos/rsvps/seating.
alter table public.event_guests
  add constraint event_guests_phone_check
    check (phone is null or phone ~ '^[0-9+\-\s]{7,15}$'),
  add constraint event_guests_status_check
    check (status in ('pending','confirmed','canceled')),
  add constraint event_guests_guests_count_check
    check (guests_count >= 0 and guests_count <= 20),
  add constraint event_guests_notes_check
    check (notes is null or char_length(notes) <= 500),
  add constraint event_guests_guest_name_check
    check (char_length(guest_name) >= 1 and char_length(guest_name) <= 100);

-- No FK existed, so guest rows could outlive their event.
alter table public.event_guests
  alter column event_id set not null,
  add constraint event_guests_event_id_fkey
    foreign key (event_id) references public.events(id) on delete cascade;

create index if not exists event_guests_event_id_status_idx
  on public.event_guests (event_id, status);
