-- Group magic-link parties by a NORMALIZED phone instead of the exact string.
--
-- Before: rsvp_guest_group / rsvp_add_companion / rsvp_remove_companion matched
-- `g.phone = anchor.phone` character for character, so "050-1234567",
-- "050 123 4567" and "972501234567" were three different parties. The admin
-- guest list already groups them together (GuestListManager.jsx), which meant
-- a shared group link opened only some of the members it showed.
--
-- Now all three functions compare public.normalize_guest_phone(phone), which
-- mirrors groupingPhoneKey() in GuestListManager.jsx exactly:
--   * keep digits only, then a leading 972 becomes 0
--   * fewer than 9 or more than 13 digits -> NULL (not a real number)
--   * last 7 digits all the same (050-0000000 placeholders) -> NULL
-- NULL never groups, so guests with no phone or a placeholder phone are each a
-- party of one. That also closes a leak: today a magic link of a guest whose
-- phone is the placeholder "050-0000000" loads every OTHER guest with that same
-- placeholder.
--
-- Backward-compatible: signatures and return shapes are unchanged, and every
-- pair of rows that matched before still matches (except placeholder phones,
-- see above). Safe to apply before or after the matching frontend deploy.

create or replace function public.normalize_guest_phone(p_phone text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select case
           when char_length(n) < 9 or char_length(n) > 13 then null
           when right(n, 7) ~ '^(\d)\1{6}$' then null
           else n
         end
    from (
      select case
               when d like '972%' then '0' || substr(d, 4)
               else d
             end as n
        from (select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as d) digits
    ) normalized;
$function$;

-- Internal helper: only the security-definer RPCs below call it.
revoke all on function public.normalize_guest_phone(text) from public, anon, authenticated;

-- Group lookups filter on (event_id, normalized phone).
create index if not exists event_guests_event_normalized_phone_idx
  on public.event_guests (event_id, public.normalize_guest_phone(phone));

-- ---------------------------------------------------------------------------
-- 1. Load a party from any member's magic link
-- ---------------------------------------------------------------------------
create or replace function public.rsvp_guest_group(p_guest_id uuid)
returns table (
  id            uuid,
  guest_name    text,
  status        text,
  guests_count  integer,
  under_5_count integer,
  notes         text,
  dietary       text,
  event_id      uuid,
  is_self       boolean
)
language sql
stable
security definer
set search_path to ''
as $function$
  with anchor as (
    select g.event_id, public.normalize_guest_phone(g.phone) as phone_key, g.id
      from public.event_guests g
     where g.id = p_guest_id
  )
  select g.id, g.guest_name, g.status, g.guests_count, g.under_5_count,
         g.notes, g.dietary, g.event_id,
         (g.id = a.id) as is_self
    from public.event_guests g
    join anchor a on g.event_id = a.event_id
   where g.id = a.id
      -- `= a.phone_key` is never true when it is null, so a guest without a
      -- real phone resolves to a party of exactly one.
      or (a.phone_key is not null
          and public.normalize_guest_phone(g.phone) = a.phone_key)
   order by (g.id = a.id) desc, g.created_at asc;
$function$;

revoke all on function public.rsvp_guest_group(uuid) from public;
grant execute on function public.rsvp_guest_group(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Grow a party from the magic link
-- ---------------------------------------------------------------------------
-- The new row copies the primary's phone exactly as stored, so it normalizes
-- to the same key. Without a key it could never be found again.
create or replace function public.rsvp_add_companion(
  p_primary_guest_id uuid,
  p_guest_name       text,
  p_dietary          text default 'regular'
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_event_id  uuid;
  v_phone     text;
  v_phone_key text;
  v_size      integer;
  v_id        uuid;
  v_name      text := trim(coalesce(p_guest_name, ''));
begin
  select g.event_id, g.phone, public.normalize_guest_phone(g.phone)
    into v_event_id, v_phone, v_phone_key
    from public.event_guests g where g.id = p_primary_guest_id;

  if v_event_id is null then
    raise exception 'guest_not_found';
  end if;

  if v_phone_key is null then
    raise exception 'primary_has_no_phone';
  end if;

  if char_length(v_name) < 1 or char_length(v_name) > 100 then
    raise exception 'invalid_guest_name';
  end if;

  if coalesce(p_dietary,'regular')
       not in ('regular','vegetarian','vegan','gluten_free','kids','under_5') then
    raise exception 'invalid_dietary';
  end if;

  select count(*) into v_size
    from public.event_guests g
   where g.event_id = v_event_id
     and public.normalize_guest_phone(g.phone) = v_phone_key;
  if v_size >= 20 then
    raise exception 'invalid_guests_count';
  end if;

  insert into public.event_guests
    (event_id, guest_name, phone, status, guests_count, dietary, responded_at)
  values
    (v_event_id, v_name, v_phone, 'confirmed', 1,
     coalesce(p_dietary,'regular'), now())
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.rsvp_add_companion(uuid, text, text) from public;
grant execute on function public.rsvp_add_companion(uuid, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Shrink a party from the magic link
-- ---------------------------------------------------------------------------
-- Still guarded so a link can only delete within its OWN party, and never the
-- primary itself.
create or replace function public.rsvp_remove_companion(
  p_primary_guest_id uuid,
  p_companion_id     uuid
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_event_id  uuid;
  v_phone_key text;
begin
  if p_primary_guest_id = p_companion_id then
    raise exception 'cannot_remove_primary';
  end if;

  select g.event_id, public.normalize_guest_phone(g.phone)
    into v_event_id, v_phone_key
    from public.event_guests g where g.id = p_primary_guest_id;

  if v_event_id is null then
    raise exception 'guest_not_found';
  end if;
  if v_phone_key is null then
    raise exception 'primary_has_no_phone';
  end if;

  delete from public.event_guests g
   where g.id = p_companion_id
     and g.event_id = v_event_id
     and public.normalize_guest_phone(g.phone) = v_phone_key;

  if not found then
    raise exception 'guest_not_found';
  end if;
end;
$function$;

revoke all on function public.rsvp_remove_companion(uuid, uuid) from public;
grant execute on function public.rsvp_remove_companion(uuid, uuid) to anon, authenticated;
