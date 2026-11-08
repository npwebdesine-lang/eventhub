-- תמונת ההזמנה עולה עכשיו רק אחרי שהאירוע נשמר, ולכן כבר אין נתיב null_...
-- שכל משתמש מחובר יכול היה לכתוב אליו, ושלא נמחק עם האירוע. הסיומת מוגבלת
-- לסוגי התמונה שהאפליקציה מעלה (תמיד באותיות קטנות).
--
-- נדרש ש-20261108150000 כבר הורץ: בלעדיו ה-policy לא קיימת וההרצה תיכשל.
-- objects.name מסומן במפורש: בתוך תת-השאילתה name לבד נקשר ל-events.name.

alter policy "event_assets_invite_insert" on storage.objects
  with check (
    bucket_id = 'event-assets'
    and exists (
      select 1 from public.events e
      where e.owner_id = (select auth.uid())
        and objects.name ~ ('^' || e.id::text || '_[0-9]+\.(jpg|jpeg|png|webp|gif|heic|heif)$')
    )
  );
