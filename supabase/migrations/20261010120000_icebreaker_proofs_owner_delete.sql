-- ניהול "קיר התהילה" של שובר הקרח: מנהל האירוע מוחק הוכחה — גם את שורת
-- icebreaker_matches (כבר מותר ב-icebreaker_matches_delete_owner) וגם את
-- קובץ התמונה מה-bucket.
--
-- storage.objects בלי policy ל-DELETE מחזיר מ-remove() מערך ריק *בלי שגיאה*,
-- והקובץ נשאר. remove() מריץ DELETE ... RETURNING, ולכן צריך גם SELECT על
-- השורה. שתי ה-policies מצומצמות ל-proofs/<event_id>/ של אירוע שהמשתמש
-- המחובר הוא הבעלים שלו — אורחים עדיין לא יכולים לרשום או למחוק קבצים.
--
-- ההשוואה היא text מול e.id::text ולא cast ל-uuid: שם תיקייה לא תקין (קובץ
-- שהועלה בנתיב אחר) היה זורק 22P02 ומפיל כל שאילתה על ה-bucket.

create policy "icebreaker_proofs_owner_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'icebreaker-uploads'
    and (storage.foldername(name))[1] = 'proofs'
    and exists (
      select 1 from public.events e
      where e.id::text = (storage.foldername(name))[2]
        and e.owner_id = (select auth.uid())
    )
  );

create policy "icebreaker_proofs_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'icebreaker-uploads'
    and (storage.foldername(name))[1] = 'proofs'
    and exists (
      select 1 from public.events e
      where e.id::text = (storage.foldername(name))[2]
        and e.owner_id = (select auth.uid())
    )
  );
