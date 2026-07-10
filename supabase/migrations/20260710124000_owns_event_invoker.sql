-- Phase 1.6c — owns_event does not need SECURITY DEFINER (events is publicly
-- readable), so switch to SECURITY INVOKER to clear the linter warnings about
-- anon/authenticated being able to execute a SECURITY DEFINER function via RPC.
create or replace function public.owns_event(p_event_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id
      and e.owner_id = (select auth.uid())
  )
$$;
