# RSVP & Guest Management Module — Design

**Date:** 2026-07-16
**Status:** Approved (Section 1 + Section 2)
**Target:** EventHub / Eventick — React + Vite + Tailwind + GSAP + Supabase (`EventHub`, `eihsjrfncqhbmseldren`)

---

## 1. Purpose

Give an event owner a **pre-loaded invitee list** and give each invitee a **personal magic link**
(delivered over WhatsApp) that confirms or cancels their attendance in one tap.

This answers a different question from the RSVP system already in the app:

| System | Question it answers | Who creates the row |
|---|---|---|
| `rsvps` (existing, `/invite/:id`) | "Who is coming?" | The guest, self-service |
| `event_guests` (this module) | "Did **David** confirm?" | The admin, pre-loaded |

## 2. Scope decisions

These were settled during brainstorming. Recorded here because each rejects part of the original brief.

| Decision | Rationale |
|---|---|
| **Coexist** with `rsvps`; do not modify `Invite.jsx` or the Admin RSVP manager | `/invite/:id` is live. Rewriting it in place would break a working flow and orphan `rsvps` (which has group/allergen logic this schema lacks). |
| **Reuse `event_guests`** rather than create a table | It exists, has 0 rows, and is referenced nowhere in `src/`. `register_guest()` is likewise dead code. |
| **`SECURITY DEFINER` RPC** for the magic link, not anon RLS policies | RLS cannot see the URL (see §4). The brief's policy is not expressible. |
| **Magic link only** — no personalized invite page | A `/rsvp/:guestId` page would duplicate ~500 lines of event display from `Invite.jsx`. `/invite/:id` already shows event details. |
| **Bulk paste import** as the only intake path | Mirrors the existing seating importer in `Admin.jsx`. Manual add / CSV upload / row delete are explicitly out of scope. |
| **Clay shapes, event colors** | Guests must not jump from a branded invite to an unrelated pastel screen. |
| **Drop `rsvp_lookup`** | With magic-link-only scope, `rsvp_respond` returns everything the card needs. An unused RPC is dead code — the exact problem `event_guests` already caused. |

## 3. Data model

Migrate the existing `public.event_guests` (0 rows, unused):

```sql
-- duplicate names are legitimate on a real guest list (two "דוד כהן")
alter table public.event_guests
  drop constraint event_guests_event_id_guest_name_key;

alter table public.event_guests
  add column phone        text
    check (phone is null or phone ~ '^[0-9+\-\s]{7,15}$'),      -- matches rsvps/rideshares
  add column status       text not null default 'pending'
    check (status in ('pending','confirmed','canceled')),
  add column guests_count integer not null default 1
    check (guests_count >= 0 and guests_count <= 20),
  add column notes        text
    check (notes is null or char_length(notes) <= 500),
  add column responded_at timestamptz;                           -- distinguishes a reply from the default

alter table public.event_guests
  alter column event_id set not null,
  add constraint event_guests_event_id_fkey
    foreign key (event_id) references public.events(id) on delete cascade;

alter table public.event_guests
  add constraint event_guests_guest_name_check
    check (char_length(guest_name) >= 1 and char_length(guest_name) <= 100);

create index if not exists event_guests_event_id_status_idx
  on public.event_guests (event_id, status);
```

**Retained deliberately:**

- **`guest_name`, not `name`** (the brief says `name`). Every other table — `photos`, `rsvps`,
  `seating` — uses `guest_name`. Consistency with the codebase beats matching the brief's wording.
- **`device_id`** stays, unused by this module. **Correction (found during verification):** it was
  `NOT NULL`, not nullable as this spec originally claimed — a leftover from `register_guest()`,
  where a guest claimed their own name from a device. Admin-imported invitees have no device, so
  every import would have failed with `23502`. Now dropped to nullable
  (`20260716101845_event_guests_device_id_nullable`). Kept rather than removed: unrelated churn.
- **`created_at`** stays as the import-order sort key.

**Added deliberately:** the FK to `events` does not exist today, so guest rows could outlive their
event. `on delete cascade` also means `Admin.jsx`'s event-delete path needs no new delete call —
but see §8.

## 4. Security model

**Why the brief's RLS cannot be built.** The brief asks for anonymous `UPDATE`/`SELECT` "only if the
URL UUID matches the row `id`". RLS predicates are evaluated per row, independently of what the
client filtered on — `.eq('id', x)` is a filter the *client* chose, not something a policy can
require. The only expressible form is `USING (true)`, which would mean:

- **anon SELECT** → any visitor dumps the entire guest list **with phone numbers**, no link needed.
- **anon UPDATE** → any visitor flips any guest's status.

The capability must be enforced where the requested id is visible: inside a function.

**Table-level:** anon gets **no policies at all** on `event_guests`, so RLS denies by default. The
existing `event_guests_all_owner` policy (`ALL`, `authenticated`, `owns_event(event_id)`) already
grants admins full CRUD and is left untouched.

**Function-level:**

```sql
create or replace function public.rsvp_respond(
  p_guest_id     uuid,
  p_status       text,
  p_guests_count integer default null,
  p_notes        text    default null
)
returns table (
  guest_name    text,
  status        text,
  guests_count  integer,
  notes         text,
  event_id      uuid,
  event_name    text,
  event_date    date,
  design_config jsonb
)
language plpgsql
security definer
set search_path to ''          -- every table reference below is schema-qualified
as $$
begin
  if p_status not in ('confirmed','canceled','pending') then
    raise exception 'invalid_status';
  end if;
  if p_guests_count is not null and (p_guests_count < 0 or p_guests_count > 20) then
    raise exception 'invalid_guests_count';
  end if;

  update public.event_guests g
     set status       = p_status,
         guests_count = coalesce(p_guests_count, g.guests_count),
         notes        = coalesce(p_notes, g.notes),
         responded_at = now()
   where g.id = p_guest_id;

  if not found then
    raise exception 'guest_not_found';
  end if;

  return query
    select g.guest_name, g.status, g.guests_count, g.notes,
           e.id, e.name, e.event_date, e.design_config
      from public.event_guests g
      join public.events e on e.id = g.event_id
     where g.id = p_guest_id;
end;
$$;

revoke all on function public.rsvp_respond(uuid, text, integer, text) from public;
grant execute on function public.rsvp_respond(uuid, text, integer, text) to anon, authenticated;
```

**`SET search_path = ''` with schema-qualified references is mandatory, not stylistic.**
`SECURITY DEFINER` runs with the owner's rights; an unqualified reference under an empty search_path
is what broke `check_photo_limit()` on 2026-07-16 (`42P01`, surfaced as a 404). Here the same mistake
would be worse.

**Grant to `anon, authenticated` — both.** A signed-in owner testing their own link runs as
`authenticated`, not `anon`. Granting only `anon` reproduces the 403 regression fixed on 2026-07-16.

**Never returns `phone`.** The card has no use for it; not returning it means the magic link cannot
leak a phone number.

**Threat model.** Knowing a guest's UUID grants read+write to **that row only** — that *is* the magic
link, the same bearer tradeoff as any unsubscribe link. UUIDv4 is unguessable, so no enumeration; no
other guest is reachable; the list never leaks. Anyone the guest forwards the message to can change
that guest's answer — accepted, and visible to the admin. No rate limiting (nothing on the Supabase
Free plan provides it); an attacker holding a link can only toggle one known guest's RSVP.

## 5. Guest flow — `/rsvp-action`

**Route:** `/rsvp-action?id=<uuid>&status=confirmed|canceled`, lazy-loaded in `App.jsx` alongside the
existing routes. Query params, not path params.

**Component:** `src/pages/RsvpAction.jsx`

1. Read `id` and `status` via `useSearchParams`.
2. Validate `id` with the existing `isValidUUIDv4()` from `src/utils/deviceId.ts`; validate `status`
   against `('confirmed','canceled')`. Either invalid → clay error card, no RPC call.
3. Call `rsvp_respond(id, status)` on mount. Single round trip; the response carries the row **and**
   `design_config`, so the card themes itself as it paints.
4. Render by outcome:
   - `confirmed` → greeting by name + **GSAP confetti burst**.
   - `canceled` → soft fade-in "נשמח לראותך בפעם הבאה".
   - `guest_not_found` → "הקישור אינו תקין" clay card.
5. The card allows adjusting `guests_count` (stepper) and `notes` (saved on blur), each re-calling
   `rsvp_respond` with the current status. It offers a one-tap flip to the opposite status, and a
   link to `/invite/:id` for event details.

**Idempotency.** Re-opening an old WhatsApp link simply re-applies the same status. Safe by design.

**Accidental cancels** are recoverable via the flip link — a tap is destructive-looking, so the
escape hatch is on the card itself, not buried.

**Link previews.** WhatsApp's crawler parses HTML meta tags and does not execute SPA JavaScript, so
previews cannot silently confirm anyone. No `GET`-side-effect guard is needed.

**Motion.** Confetti respects `prefers-reduced-motion`. All GSAP tweens are captured and killed on
unmount — the Phase 2 commit fixed exactly this leak class in `Album`/`Invite`.

## 6. Admin — `GuestListManager`

**Component:** `src/components/GuestListManager.jsx`, imported into `Admin.jsx` as a section.

Other managers live inline in `Admin.jsx`, but that file already exceeds 900 lines and this one
carries an importer, tabs, a table, and an exporter. It gets its own file rather than pushing
`Admin.jsx` past ~1200.

**Data:** `select * from event_guests where event_id = <selected> order by created_at`, direct table
access under `event_guests_all_owner` (admin is `authenticated` and owns the event).

**Tabs:** All / Confirmed / Canceled / Pending, each with a live count. Active tab **debossed**
(`shadow-[inset_...]`), inactive **embossed** — the clay language carrying the state, not decoration.

**Bulk paste importer:** textarea of `name, phone, count` per line →
parse → **preview table with per-line errors** → insert as `pending`.
Invalid lines are listed with their reason, never silently dropped. Validation mirrors the DB
constraints (name 1–100, phone regex, count 0–20).

**Table columns:** name, phone, status, guests_count, notes (inline editable, saved on blur),
actions.

**WhatsApp magic link**, exact text from the brief:

```
היי [Name], מתרגשים לקראת האירוע! נשמח לאישור סופי. לאישור: [ORIGIN]/rsvp-action?id=[ID]&status=confirmed | לביטול: [ORIGIN]/rsvp-action?id=[ID]&status=canceled
```

- `[ORIGIN]` is `window.location.origin`, which **already includes the scheme** — the brief's
  `https://[APP_URL]` template would produce `https://https://…`.
- `wa.me` requires international digits: `0501234567` → `972501234567`. Rows whose phone cannot be
  normalized show a **copy-link** fallback instead of a dead `wa.me` link.
- Message is `encodeURIComponent`-encoded.

**Export CSV** of the **currently filtered** view. Prefixed with a UTF-8 BOM (`﻿`) — without it
Excel renders Hebrew as mojibake, making the export useless to a caterer. Columns: name, phone,
status, guests_count, notes.

**Confirmed-seats total:** `sum(guests_count) where status = 'confirmed'`. The one number a venue
asks for; a one-line derivation from data already fetched.

## 7. Styling

Soft 3D / Claymorphism via Tailwind arbitrary values. All layouts `dir="rtl"`.

```
embossed card : rounded-[2rem] shadow-[8px_8px_16px_rgba(0,0,0,.18),-8px_-8px_16px_rgba(255,255,255,.55)]
debossed      : shadow-[inset_6px_6px_12px_rgba(0,0,0,.18),inset_-6px_-6px_12px_rgba(255,255,255,.5)]
```

Hue is driven by CSS custom properties set from `design_config.colors` (primary/secondary/
background), with a pastel clay palette as fallback when `design_config` is null. Shape language is
fixed; colour is per-event.

## 8. Out of scope / follow-ups

- Manual single-guest add, CSV **file** upload, row delete, and inline editing of fields other than
  `notes`. A typo'd import row currently requires a DB fix — accepted for v1.
- `Admin.jsx`'s `handleDeleteEvent` deletes rows table-by-table. The new FK is `on delete cascade`,
  so `event_guests` needs no explicit delete — but if that function is ever switched to a
  non-cascading path, it must be revisited.
- `register_guest()` and `device_id` on `event_guests` remain dead code. Not removed here; unrelated.
- No rate limiting on `rsvp_respond` (see §4).

## 9. Verification

Every claim below must be demonstrated, not assumed.

**Database (per the 2026-07-16 lessons — test both roles, and spoofed access):**

| Check | Expected |
|---|---|
| `rsvp_respond` as `anon` with a valid id | ALLOWED, updates exactly that row |
| `rsvp_respond` as `authenticated` with a valid id | ALLOWED (the `TO anon`-only regression) |
| `rsvp_respond` with a random uuid | raises `guest_not_found`, mutates nothing |
| `rsvp_respond` with `status='hacked'` | raises `invalid_status` |
| `rsvp_respond` with `guests_count=999` | raises `invalid_guests_count` |
| Direct `select` on `event_guests` as `anon` | 0 rows (no policy) — the list must not leak |
| Direct `update` on `event_guests` as `anon` | BLOCKED |
| `select` as event owner (`authenticated`) | own event's rows visible |
| `rsvp_respond` touching another guest's row | impossible — verify only `p_guest_id` changed |
| Advisors after migration | no new `rls_policy_always_true`; no mutable-search_path warning. **Expected new warnings:** `0028`/`0029` (SECURITY DEFINER executable by anon/authenticated) — intentional, that *is* the magic link |

**Frontend:** confirm and cancel paths render correctly; an invalid id shows the error card; the
count stepper and notes persist; CSV opens in Excel with legible Hebrew; a `wa.me` link opens with
the message pre-filled and the magic link resolving to a real row; unparseable phone falls back to
copy-link; `prefers-reduced-motion` suppresses confetti.

## 10. Implementation order

1. Migration (§3) + `rsvp_respond` (§4), applied via MCP and committed to `supabase/migrations/`.
2. DB verification matrix (§9) — before any UI exists.
3. `RsvpAction.jsx` + route (§5).
4. `GuestListManager.jsx` + `Admin.jsx` wiring (§6).
5. Frontend verification (§9), then deploy.
