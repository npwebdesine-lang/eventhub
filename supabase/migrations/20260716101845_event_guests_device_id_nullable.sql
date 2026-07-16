-- event_guests.device_id was NOT NULL, a leftover from the abandoned register_guest()
-- flow where a guest claimed their own name from a device. In the RSVP module the admin
-- pre-loads invitees who have no device yet, so every bulk import would have failed with
-- 23502. Caught by the verification matrix before any UI existed.
--
-- The column is unused by this module and kept only to avoid unrelated churn.

alter table public.event_guests
  alter column device_id drop not null;
