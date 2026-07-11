-- Records the effective form of the blessings is_approved lockdown applied to
-- the already-migrated project (the previous migration's single-column revoke
-- was overridden by the table-level INSERT grant). Anon may insert only the
-- guest-writable columns; is_approved falls back to its DEFAULT (true).
revoke insert on public.blessings from anon;
grant insert (event_id, guest_name, message, image_url) on public.blessings to anon;
