-- תיקון ל-20261010120000_icebreaker_proofs_owner_delete: בתוך תת-השאילתה
-- exists (select ... from public.events e ...) ה-`name` הלא-מוסמך נקשר ל-
-- events.name (שם האירוע) ולא ל-objects.name, כי לטבלת events יש עמודה בשם
-- הזה. התנאי הפך ל-storage.foldername(e.name) ואף פעם לא התקיים — הבעלים
-- לא ראה ולא מחק אף קובץ (נכשל "סגור", לא נחשף כלום).
-- הלקח: בתוך policy עם תת-שאילתה, תמיד להסמיך את עמודות הטבלה המוגנת.

alter policy "icebreaker_proofs_owner_select" on storage.objects
  using (
    bucket_id = 'icebreaker-uploads'
    and (storage.foldername(objects.name))[1] = 'proofs'
    and exists (
      select 1 from public.events e
      where e.id::text = (storage.foldername(objects.name))[2]
        and e.owner_id = (select auth.uid())
    )
  );

alter policy "icebreaker_proofs_owner_delete" on storage.objects
  using (
    bucket_id = 'icebreaker-uploads'
    and (storage.foldername(objects.name))[1] = 'proofs'
    and exists (
      select 1 from public.events e
      where e.id::text = (storage.foldername(objects.name))[2]
        and e.owner_id = (select auth.uid())
    )
  );
