-- Storage: allow anon to upload, read, and delete in bucket "Mobideal"
-- Run this after creating the bucket "Mobideal" in Dashboard → Storage → New bucket (public or private).
-- If you already ran this file before the DELETE policy was added, run only the last policy block.

-- Allow anyone (including anon) to INSERT into Mobideal bucket
create policy "Mobideal anon insert"
on storage.objects for insert
to public
with check (bucket_id = 'Mobideal');

-- Allow anyone to SELECT (read) from Mobideal bucket
create policy "Mobideal anon select"
on storage.objects for select
to public
using (bucket_id = 'Mobideal');

-- Allow anyone to DELETE from Mobideal bucket (so uploaded files can be removed)
create policy "Mobideal anon delete"
on storage.objects for delete
to public
using (bucket_id = 'Mobideal');
