-- מחיקת אירוע מנקה את כל הקבצים שלו. שאר הנתיבים כבר מכוסים:
-- photos/ ב-event-assets (20261108130000) ו-proofs/ ב-icebreaker-uploads
-- (20261010120000). כאן מתווספים תמונת ההזמנה (<event_id>_... בשורש של
-- event-assets), הברכות, פרופילי ההיכרויות ופרופילי שובר הקרח.
--
-- remove() צריך גם SELECT וגם DELETE (ראו שם), ו-list() צריך SELECT. הכל מוגבל
-- לבעלי האירוע, ואורחים עדיין לא יכולים לרשום או למחוק קבצים.
-- objects.name מסומן במפורש: בתוך תת-השאילתה name לבד נקשר ל-events.name.

create policy "event_files_owner_select" on storage.objects
  for select to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.owner_id = (select auth.uid())
        and (
          (objects.bucket_id = 'event-assets'
            and starts_with(objects.name, e.id::text || '_'))
          or (objects.bucket_id in ('blessings-uploads', 'dating-profiles')
            and (storage.foldername(objects.name))[1] = e.id::text)
          or (objects.bucket_id = 'icebreaker-uploads'
            and (storage.foldername(objects.name))[1] = 'profiles'
            and (storage.foldername(objects.name))[2] = e.id::text)
        )
    )
  );

create policy "event_files_owner_delete" on storage.objects
  for delete to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.owner_id = (select auth.uid())
        and (
          (objects.bucket_id = 'event-assets'
            and starts_with(objects.name, e.id::text || '_'))
          or (objects.bucket_id in ('blessings-uploads', 'dating-profiles')
            and (storage.foldername(objects.name))[1] = e.id::text)
          or (objects.bucket_id = 'icebreaker-uploads'
            and (storage.foldername(objects.name))[1] = 'profiles'
            and (storage.foldername(objects.name))[2] = e.id::text)
        )
    )
  );
