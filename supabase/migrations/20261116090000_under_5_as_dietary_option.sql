-- Children under 5 become named guests instead of a separate counter.
--
-- The RSVP form no longer shows an "under 5" counter. A guest who brings a baby
-- adds them with "הוסף אורח" like anyone else and picks the dietary option
-- "ילדים מתחת לגיל 5 (ללא מנה)". So the child is a real row, with a name, in the
-- family's group -- which is also what seating needs (who gets the high chair).
--
-- The two totals the venue cares about keep their meaning and their queries:
--   paid meals = sum(guests_count), under 5 = sum(under_5_count), confirmed rows.
-- An under-5 row therefore has to count as 0 meals and 1 child:
--
--   dietary = 'under_5'  =>  guests_count = 0, under_5_count = 1
--
-- That invariant is enforced by a trigger rather than in each write path,
-- because there are five of them (rsvp_self_register, rsvp_add_companion,
-- rsvp_respond, the admin's direct table edits, and imports) and a path that
-- forgot it would silently bill the family for a plate. In particular
-- rsvp_add_companion inserts guests_count = 1, and the magic link resets a
-- confirmed row to guests_count = 1; the trigger corrects both.
--
-- under_5_count stays a column (not derived from dietary) so every existing
-- total keeps working unchanged, and so a count set by hand by the admin on a
-- family's row is still honoured.
--
-- DEPLOY ORDER: apply before shipping the frontend that offers the option. The
-- old frontend is unaffected -- it never sends 'under_5'.

-- ---------------------------------------------------------------------------
-- 1. The new dietary value
-- ---------------------------------------------------------------------------
alter table public.event_guests
  drop constraint if exists event_guests_dietary_check;

alter table public.event_guests
  add constraint event_guests_dietary_check
    check (dietary in ('regular','vegetarian','vegan','gluten_free','kids','under_5'));

-- ---------------------------------------------------------------------------
-- 2. The invariant
-- ---------------------------------------------------------------------------
-- No table references, so the empty search_path needs no qualification here.
create or replace function public.event_guests_sync_under_5()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if new.dietary = 'under_5' then
    new.guests_count  := 0;
    new.under_5_count := 1;
  elsif tg_op = 'UPDATE' and old.dietary = 'under_5' then
    -- The row stops being an under-5 child (e.g. the guest picked the wrong
    -- option and corrects it): it is a paid meal again, and no longer a child.
    new.under_5_count := 0;
    if new.guests_count = 0 then
      new.guests_count := 1;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists event_guests_sync_under_5 on public.event_guests;

create trigger event_guests_sync_under_5
  before insert or update on public.event_guests
  for each row execute function public.event_guests_sync_under_5();

-- ---------------------------------------------------------------------------
-- 3. The RSVP functions accept the new value
-- ---------------------------------------------------------------------------
-- Same signatures as 20261115120000, so CREATE OR REPLACE is enough (no new
-- overloads, no return-type change). Bodies are carried over verbatim; only the
-- accepted dietary list changes, plus the primary-guest rule in
-- rsvp_self_register.

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
     and p_dietary not in ('regular','vegetarian','vegan','gluten_free','kids','under_5') then
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
    if v_dietary not in ('regular','vegetarian','vegan','gluten_free','kids','under_5') then
      raise exception 'invalid_dietary';
    end if;
    -- The first guest is the person registering -- by definition not a child
    -- under 5. Without this, a party of only "under 5" rows would be a
    -- confirmed registration with zero paid meals.
    if v_index = 0 and v_dietary = 'under_5' then
      raise exception 'invalid_dietary';
    end if;

    insert into public.event_guests
      (event_id, guest_name, phone, status, guests_count, under_5_count,
       notes, dietary, responded_at)
    values
      (p_event_id, v_name, v_phone, 'confirmed', 1,
       case when v_index = 0 then v_under_5 else 0 end,
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
  v_event_id uuid;
  v_phone    text;
  v_size     integer;
  v_id       uuid;
  v_name     text := trim(coalesce(p_guest_name, ''));
begin
  select g.event_id, g.phone into v_event_id, v_phone
    from public.event_guests g where g.id = p_primary_guest_id;

  if v_event_id is null then
    raise exception 'guest_not_found';
  end if;

  if v_phone is null then
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
   where g.event_id = v_event_id and g.phone = v_phone;
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

-- A trigger function is never meant to be called directly.
revoke all on function public.event_guests_sync_under_5() from public, anon, authenticated;
