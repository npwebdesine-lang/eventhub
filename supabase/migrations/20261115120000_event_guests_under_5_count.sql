-- Children under 5: attending, but not a paid meal.
--
-- The venue does not count children under 5 towards the final paid meal count,
-- yet seating still has to know about them (high chairs, strollers). So they
-- are tracked NEXT TO the headcount rather than inside it:
--
--   guests_count   -> paid meals (age 5 and up). The number the venue gets.
--   under_5_count  -> babies / children under 5. No meal, seating only.
--
-- Why a counter and not rows: since 20260811103000 one person = one row, because
-- every person needs a name and a dietary preference. A child under 5 needs
-- neither -- there is no meal to choose -- so a row per baby would only inflate
-- the paid count the venue reads (each row is guests_count = 1). The counter
-- lives on the row of the person who answered: the primary of a
-- self-registration, or the row a magic link addresses.
--
-- Totals are therefore plain sums over confirmed rows:
--   paid meals = sum(guests_count), babies = sum(under_5_count).
--
-- NOT NULL + default + check, same convention as guests_count. Existing rows
-- backfill to 0, which is exactly what they meant until now.
--
-- DEPLOY ORDER: apply this migration BEFORE shipping the frontend that sends
-- p_under_5_count. The reverse order breaks RSVP (PGRST202, no matching
-- function). The old frontend keeps working against the new functions, because
-- the new parameter is defaulted and each function has a single overload.

alter table public.event_guests
  add column if not exists under_5_count integer not null default 0;

alter table public.event_guests
  drop constraint if exists event_guests_under_5_count_check;

alter table public.event_guests
  add constraint event_guests_under_5_count_check
    check (under_5_count >= 0 and under_5_count <= 20);

-- ---------------------------------------------------------------------------
-- 1. rsvp_respond gains p_under_5_count and returns the stored value
-- ---------------------------------------------------------------------------
-- DROP + CREATE, not CREATE OR REPLACE, for the same two reasons as in
-- 20260806143000: a new defaulted parameter would create an OVERLOAD (42725
-- "function is not unique" on the next call), and Postgres refuses to change
-- the return type of an existing function.
--
-- null keeps the stored value (coalesce), like every other optional field, so
-- changing dietary or notes never resets the under-5 count and vice versa.
drop function if exists public.rsvp_respond(uuid, text, integer, text, text);

create or replace function public.rsvp_respond(
  p_guest_id      uuid,
  p_status        text,
  p_guests_count  integer default null,
  p_notes         text    default null,
  p_dietary       text    default null,
  p_under_5_count integer default null
)
returns table (
  guest_name    text,
  status        text,
  guests_count  integer,
  under_5_count integer,
  notes         text,
  dietary       text,
  event_id      uuid,
  event_name    text,
  event_date    date,
  design_config jsonb
)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if p_status is null or p_status not in ('confirmed','canceled','pending') then
    raise exception 'invalid_status';
  end if;

  if p_guests_count is not null and (p_guests_count < 0 or p_guests_count > 20) then
    raise exception 'invalid_guests_count';
  end if;

  if p_under_5_count is not null and (p_under_5_count < 0 or p_under_5_count > 20) then
    raise exception 'invalid_under_5_count';
  end if;

  if p_notes is not null and char_length(p_notes) > 500 then
    raise exception 'invalid_notes';
  end if;

  if p_dietary is not null
     and p_dietary not in ('regular','vegetarian','vegan','gluten_free','kids') then
    raise exception 'invalid_dietary';
  end if;

  update public.event_guests g
     set status        = p_status,
         guests_count  = coalesce(p_guests_count, g.guests_count),
         under_5_count = coalesce(p_under_5_count, g.under_5_count),
         notes         = coalesce(p_notes, g.notes),
         dietary       = coalesce(p_dietary, g.dietary),
         responded_at  = now()
   where g.id = p_guest_id;

  if not found then
    raise exception 'guest_not_found';
  end if;

  return query
    select g.guest_name, g.status, g.guests_count, g.under_5_count, g.notes,
           g.dietary, e.id, e.name, e.event_date, e.design_config
      from public.event_guests g
      join public.events e on e.id = g.event_id
     where g.id = p_guest_id;
end;
$function$;

revoke all on function public.rsvp_respond(uuid, text, integer, text, text, integer) from public;
grant execute on function public.rsvp_respond(uuid, text, integer, text, text, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Self-registration stores the under-5 count on the primary's row
-- ---------------------------------------------------------------------------
-- Same DROP + CREATE reasoning (new parameter = new signature). Body is carried
-- over verbatim from 20260811103000 apart from the new field.
drop function if exists public.rsvp_self_register(uuid, text, jsonb, text);

create or replace function public.rsvp_self_register(
  p_event_id      uuid,
  p_phone         text,
  p_guests        jsonb,
  p_notes         text    default null,
  p_under_5_count integer default 0
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_primary_id uuid;
  v_id         uuid;
  v_count      integer;
  v_under_5    integer := coalesce(p_under_5_count, 0);
  v_phone      text;
  v_notes      text;
  v_guest      jsonb;
  v_name       text;
  v_dietary    text;
  v_index      integer := 0;
begin
  if p_guests is null or jsonb_typeof(p_guests) <> 'array' then
    raise exception 'invalid_guests';
  end if;

  v_count := jsonb_array_length(p_guests);
  if v_count < 1 or v_count > 20 then
    raise exception 'invalid_guests_count';
  end if;

  if v_under_5 < 0 or v_under_5 > 20 then
    raise exception 'invalid_under_5_count';
  end if;

  if p_phone is not null and p_phone <> ''
     and p_phone !~ '^[0-9+\-\s]{7,15}$' then
    raise exception 'invalid_phone';
  end if;
  v_phone := nullif(trim(coalesce(p_phone, '')), '');

  if not exists (select 1 from public.events e where e.id = p_event_id) then
    raise exception 'event_not_found';
  end if;

  v_notes := nullif(trim(coalesce(p_notes, '')), '');
  if v_notes is not null and char_length(v_notes) > 500 then
    v_notes := left(v_notes, 500);
  end if;

  for v_guest in select * from jsonb_array_elements(p_guests)
  loop
    v_name    := trim(coalesce(v_guest ->> 'name', ''));
    v_dietary := coalesce(nullif(v_guest ->> 'dietary', ''), 'regular');

    if char_length(v_name) < 1 or char_length(v_name) > 100 then
      raise exception 'invalid_guest_name';
    end if;
    if v_dietary not in ('regular','vegetarian','vegan','gluten_free','kids') then
      raise exception 'invalid_dietary';
    end if;

    insert into public.event_guests
      (event_id, guest_name, phone, status, guests_count, under_5_count,
       notes, dietary, responded_at)
    values
      (p_event_id, v_name, v_phone, 'confirmed', 1,
       -- the party's under-5 children are counted ONCE, on the primary's row;
       -- repeating the number on every row would multiply it in the totals
       case when v_index = 0 then v_under_5 else 0 end,
       -- free-text notes belong to the person who typed them, i.e. the primary
       case when v_index = 0 then v_notes else null end,
       v_dietary, now())
    returning id into v_id;

    if v_index = 0 then
      v_primary_id := v_id;
    end if;
    v_index := v_index + 1;
  end loop;

  return v_primary_id;
end;
$function$;

revoke all on function public.rsvp_self_register(uuid, text, jsonb, text, integer) from public;
grant execute on function public.rsvp_self_register(uuid, text, jsonb, text, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. The magic-link read path returns the stored count
-- ---------------------------------------------------------------------------
-- The return type gains a column, so this one must be dropped first as well.
drop function if exists public.rsvp_guest_group(uuid);

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
    select g.event_id, g.phone, g.created_at, g.id
      from public.event_guests g
     where g.id = p_guest_id
  )
  select g.id, g.guest_name, g.status, g.guests_count, g.under_5_count,
         g.notes, g.dietary, g.event_id,
         (g.id = a.id) as is_self
    from public.event_guests g
    join anchor a on g.event_id = a.event_id
   where g.id = a.id
      or (a.phone is not null and g.phone = a.phone)
   order by (g.id = a.id) desc, g.created_at asc;
$function$;

revoke all on function public.rsvp_guest_group(uuid) from public;
grant execute on function public.rsvp_guest_group(uuid) to anon, authenticated;
