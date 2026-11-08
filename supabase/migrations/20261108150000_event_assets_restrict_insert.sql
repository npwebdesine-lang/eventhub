-- event_assets_insert אפשר לכל אחד להעלות כל שם קובץ ל-event-assets, ועם מגבלת
-- 25MB זו דרך למלא את האחסון בלי לעבור באפליקציה. מעכשיו מותרים רק הנתיבים
-- שהאפליקציה יוצרת:
--
--   אורחים (Photos.jsx): photos/photo_<event_id>_<ts>_<8hex>.jpg
--                        photos/video_<event_id>_<ts>_<8hex>.(mp4|webm|mov)
--   מנהל (Admin.jsx):    <event_id>_<ts>.<ext>, או null_<ts>.<ext> באירוע חדש
--                        שעדיין לא נשמר ולכן אין לו מזהה.
--
-- objects.name מסומן במפורש: בתוך תת-השאילתה name לבד נקשר ל-events.name.

drop policy if exists "event_assets_insert" on storage.objects;

create policy "event_assets_photos_insert" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'event-assets'
    and objects.name ~ '^photos/(photo_[0-9a-f-]{36}_[0-9]+_[0-9a-f]{8}\.jpg|video_[0-9a-f-]{36}_[0-9]+_[0-9a-f]{8}\.(mp4|webm|mov))$'
    and exists (
      select 1 from public.events e
      where e.id::text = substring(objects.name from '^photos/(?:photo|video)_([0-9a-f-]{36})_')
    )
  );

create policy "event_assets_invite_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'event-assets'
    and (
      objects.name ~ '^null_[0-9]+\.[^/]+$'
      or exists (
        select 1 from public.events e
        where e.owner_id = (select auth.uid())
          and objects.name ~ ('^' || e.id::text || '_[0-9]+\.[^/]+$')
      )
    )
  );
