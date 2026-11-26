-- One printed QR per payment app (bit / PayBox) that alternates every scan
-- between the groom's and the bride's link.
--
-- The QR points at /g/<provider>/<event code> (api/gift-redirect.js), which
-- calls resolve_gift_redirect() and 302s to the link it returns. The links
-- live in events.design_config, so the hosts can change them at any time
-- without reprinting:
--   design_config.bit_links    = ["<groom link>", "<bride link>"]
--   design_config.paybox_links = ["<groom link>", "<bride link>"]
-- Events saved before this change only have design_config.bit_link; it is
-- used as the single bit link when bit_links has no valid entry.
--
-- Why a separate table and not a counter column on events: the dashboard
-- saves the whole events row from its form state, so a counter column there
-- would be overwritten with a stale value on every "save".
--
-- Why the host allowlist here: this function decides where OUR domain sends
-- people. Only https links to the real bit / PayBox domains are returned, so
-- an event can never turn /g/... into a redirect to an arbitrary site.

create table if not exists public.event_gift_scan_counters (
  event_id   uuid        not null references public.events(id) on delete cascade,
  provider   text        not null check (provider in ('bit', 'paybox')),
  scans      bigint      not null default 0,
  updated_at timestamptz not null default now(),
  primary key (event_id, provider)
);

-- Nobody reads or writes it directly: only resolve_gift_redirect (security
-- definer) touches it. RLS on with no policies = closed to anon/authenticated.
alter table public.event_gift_scan_counters enable row level security;
revoke all on table public.event_gift_scan_counters from public, anon, authenticated;

create or replace function public.resolve_gift_redirect(
  p_event_id uuid,
  p_provider text
)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_config  jsonb;
  v_host_re text;
  v_links   text[];
  v_count   bigint;
begin
  if p_provider is null or p_provider not in ('bit', 'paybox') then
    return null;
  end if;

  select e.design_config into v_config
    from public.events e
   where e.id = p_event_id;
  if not found then
    return null;
  end if;

  -- https + exact host or a subdomain of it; the path may be anything but
  -- must not contain whitespace, quotes or angle brackets.
  v_host_re := case p_provider
    when 'bit' then
      '^https://([a-z0-9-]+\.)*bitpay\.co\.il(:443)?(/[^\s"<>]*)?$'
    else
      '^https://([a-z0-9-]+\.)*(payboxapp\.com|payboxapp\.page\.link)(:443)?(/[^\s"<>]*)?$'
  end;

  -- Keep the configured order (groom first), dropping empty/invalid entries.
  select coalesce(array_agg(link order by ord), array[]::text[])
    into v_links
    from (
      select trim(value) as link, ord
        from jsonb_array_elements_text(
               case when jsonb_typeof(v_config -> (p_provider || '_links')) = 'array'
                    then v_config -> (p_provider || '_links')
                    else '[]'::jsonb
               end
             ) with ordinality as t(value, ord)
    ) links
   where links.link ~* v_host_re;

  -- Backward compatibility: events saved before bit_links existed.
  if cardinality(v_links) = 0 and p_provider = 'bit'
     and trim(coalesce(v_config ->> 'bit_link', '')) ~* v_host_re then
    v_links := array[trim(v_config ->> 'bit_link')];
  end if;

  if cardinality(v_links) = 0 then
    return null;  -- nothing configured: the caller sends the guest to the invite
  end if;

  -- Atomic: concurrent scans each get their own number (row lock on upsert).
  insert into public.event_gift_scan_counters as c (event_id, provider, scans)
  values (p_event_id, p_provider, 1)
  on conflict (event_id, provider)
  do update set scans = c.scans + 1, updated_at = now()
  returning c.scans into v_count;

  -- scan 1 -> link 1, scan 2 -> link 2, scan 3 -> link 1, ...
  return v_links[((v_count - 1) % cardinality(v_links)) + 1];
end;
$function$;

revoke all on function public.resolve_gift_redirect(uuid, text) from public;
grant execute on function public.resolve_gift_redirect(uuid, text) to anon, authenticated;
