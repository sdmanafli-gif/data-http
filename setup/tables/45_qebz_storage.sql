-- ============================================================
-- 45: Qəbz şəkilləri üçün fayl yeri (WhatsApp linki)
-- «WhatsApp-a göndər» basanda qəbz şəkli bura yüklənir, mesajda linki gedir.
-- Fayl adları uzun və təsadüfidir; linki bilən şəkli görür, siyahını görmək olmur.
-- Yalnız işçilər (is_staff) yükləyə bilər. Mövcud cədvəllərə toxunmur.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('q', 'q', true, 5242880, array['image/png'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Staff upload qebz" on storage.objects;
create policy "Staff upload qebz" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'q' and (select public.is_staff()));
