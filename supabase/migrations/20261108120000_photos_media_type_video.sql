-- העלאת סרטונים למודול "כל אחד צלם". טבלת photos משמשת גם לסרטונים, ו-
-- image_url מחזיק את כתובת הקובץ בשני המקרים.
--
-- 1) העמודה: שורות קיימות הן תמונות, ולכן ברירת המחדל מכסה אותן.
alter table public.photos
  add column media_type text not null default 'image',
  add constraint photos_media_type_check check (media_type in ('image', 'video'));

-- 2) המכסה נספרת בנפרד לכל סוג: 10 תמונות ו-2 סרטונים לאורח באירוע.
--    search_path ריק, ולכן כל טבלה חייבת להיות מסוימת בסכמה.
create or replace function public.check_photo_limit()
returns trigger
language plpgsql
set search_path to ''
as $function$
DECLARE
    media_count INTEGER;
    media_limit INTEGER := CASE WHEN NEW.media_type = 'video' THEN 2 ELSE 10 END;
BEGIN
    SELECT COUNT(*) INTO media_count
    FROM public.photos
    WHERE guest_id = NEW.guest_id
    AND event_id = NEW.event_id
    AND media_type = NEW.media_type;

    IF media_count >= media_limit THEN
        IF NEW.media_type = 'video' THEN
            RAISE EXCEPTION 'video_limit_exceeded';
        END IF;
        RAISE EXCEPTION 'photo_limit_exceeded';
    END IF;

    RETURN NEW;
END;
$function$;

-- 3) ה-bucket חסם עד עכשיו כל קובץ שאינו תמונה וכל קובץ מעל 10MB. המגבלה
--    היא ברמת ה-bucket, ולכן היא עולה גם להעלאות התמונות של המנהל.
update storage.buckets
set file_size_limit = 26214400, -- 25 MB
    allowed_mime_types = array[
      'image/jpeg','image/jpg','image/png','image/webp','image/gif','image/heic','image/heif',
      'video/mp4','video/webm','video/quicktime'
    ]
where id = 'event-assets';
