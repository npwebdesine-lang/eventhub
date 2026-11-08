-- מחיקה מהגלריה בניהול: מנהל האירוע מוחק גם את הקובץ מ-event-assets, אחרת
-- תמונות וסרטונים נשארים באחסון אחרי מחיקת השורה.
--
-- כמו ב-icebreaker_proofs: בלי policy ל-DELETE, ה-remove() מחזיר מערך ריק בלי
-- שגיאה, והוא מריץ DELETE ... RETURNING ולכן צריך גם SELECT על השורה.
--
-- הקבצים לא בתיקייה לפי אירוע אלא בשם photos/(photo|video)_<event_id>_...,
-- ולכן מזהה האירוע נשלף מהשם. אורחים עדיין לא יכולים לרשום או למחוק קבצים.
-- objects.name מסומן במפורש: בתוך תת-השאילתה name לבד נקשר ל-events.name.

create policy "event_assets_photos_owner_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'event-assets'
    and (storage.foldername(objects.name))[1] = 'photos'
    and exists (
      select 1 from public.events e
      where e.id::text = substring(storage.filename(objects.name) from '^(?:photo|video)_([0-9a-f-]{36})_')
        and e.owner_id = (select auth.uid())
    )
  );

create policy "event_assets_photos_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'event-assets'
    and (storage.foldername(objects.name))[1] = 'photos'
    and exists (
      select 1 from public.events e
      where e.id::text = substring(storage.filename(objects.name) from '^(?:photo|video)_([0-9a-f-]{36})_')
        and e.owner_id = (select auth.uid())
    )
  );
