-- Phase 1.6a — Pin function search_path and constrain storage buckets.
--
-- Mutable search_path on SECURITY-relevant functions is a known injection
-- vector; pin it. Buckets had no size or MIME limits, so a guest could upload
-- arbitrary large / non-image files. Cap size and restrict to image types.
-- (blessings-uploads currently receives the original, uncompressed file — the
-- Phase 2 change routes it through the shared jpeg compressor; the generous
-- image allowlist below covers iPhone HEIC in the meantime.)

alter function public.is_valid_uuidv4(text) set search_path = '';
alter function public.check_photo_limit() set search_path = '';
alter function public.register_guest(uuid, text, text) set search_path = '';

update storage.buckets
set file_size_limit = 10485760, -- 10 MB
    allowed_mime_types = array[
      'image/jpeg','image/jpg','image/png','image/webp','image/gif','image/heic','image/heif'
    ]
where id in ('blessings-uploads','dating-profiles','event-assets','event-photos','icebreaker-uploads');
