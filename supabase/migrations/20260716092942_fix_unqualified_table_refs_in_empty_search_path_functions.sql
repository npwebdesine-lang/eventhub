-- Fix fallout from 20260710123000_functions_bucket_limits.sql.
--
-- That migration pinned `search_path = ''` on check_photo_limit() and
-- register_guest() (correctly — mutable search_path is an injection vector) but
-- left their bodies referencing tables *unqualified*. With an empty search_path
-- those names no longer resolve, so:
--
--   * check_photo_limit() raised 42P01 'relation "photos" does not exist' on
--     EVERY insert into photos. PostgREST surfaces 42P01 as a 404, which looked
--     like a missing table rather than a broken trigger. SELECTs were unaffected
--     because the trigger only fires on INSERT.
--   * register_guest() had the same latent bug against event_guests.
--
-- Pinning search_path is kept; the table references are schema-qualified instead.

create or replace function public.check_photo_limit()
returns trigger
language plpgsql
set search_path to ''
as $function$
DECLARE
    photo_count INTEGER;
BEGIN
    -- ספירת התמונות שכבר הועלו על ידי האורח באירוע הספציפי
    SELECT COUNT(*) INTO photo_count
    FROM public.photos
    WHERE guest_id = NEW.guest_id
    AND event_id = NEW.event_id;

    IF photo_count >= 3 THEN
        -- חסימת ההעלאה אם עבר את המכסה
        RAISE EXCEPTION 'photo_limit_exceeded';
    END IF;

    RETURN NEW;
END;
$function$;

create or replace function public.register_guest(p_event_id uuid, p_guest_name text, p_device_id text)
returns jsonb
language plpgsql
set search_path to ''
as $function$
DECLARE
    v_guest RECORD;
BEGIN
    -- ניסיון להכניס אורח חדש
    BEGIN
        INSERT INTO public.event_guests (event_id, guest_name, device_id)
        VALUES (p_event_id, p_guest_name, p_device_id)
        RETURNING * INTO v_guest;

        RETURN to_jsonb(v_guest);

    EXCEPTION WHEN unique_violation THEN
        -- אם השם כבר תפוס, נבדוק אם זה אותו מכשיר
        SELECT * INTO v_guest
        FROM public.event_guests
        WHERE event_id = p_event_id AND guest_name = p_guest_name;

        IF v_guest.device_id = p_device_id THEN
            -- זה אותו מכשיר - הכל תקין, נחזיר את פרטי האורח
            RETURN to_jsonb(v_guest);
        ELSE
            -- מכשיר אחר מנסה להשתמש בשם קיים - נזרוק שגיאה
            RAISE EXCEPTION 'Name taken on another device';
        END IF;
    END;
END;
$function$;
