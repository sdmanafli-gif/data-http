-- ============================================================
-- Sənədlər — multi-file attachments (Supabase Storage bucket Mobideal)
-- Stored as jsonb: [{ "name": "...", "path": "..." }, ...]
-- ============================================================

alter table public.musteri_bazasi
  add column if not exists senedler jsonb not null default '[]'::jsonb;

alter table public.depo
  add column if not exists senedler jsonb not null default '[]'::jsonb;

alter table public.nagd_satish
  add column if not exists senedler jsonb not null default '[]'::jsonb;

alter table public.borc_nisye_ledger
  add column if not exists senedler jsonb not null default '[]'::jsonb;

-- Ensure bucket exists (public read for links)
insert into storage.buckets (id, name, public)
values ('Mobideal', 'Mobideal', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Mobideal anon insert" on storage.objects;
drop policy if exists "Mobideal anon select" on storage.objects;
drop policy if exists "Mobideal anon delete" on storage.objects;
drop policy if exists "Mobideal public insert" on storage.objects;
drop policy if exists "Mobideal public select" on storage.objects;
drop policy if exists "Mobideal public delete" on storage.objects;

create policy "Mobideal public insert"
  on storage.objects for insert to public
  with check (bucket_id = 'Mobideal');

create policy "Mobideal public select"
  on storage.objects for select to public
  using (bucket_id = 'Mobideal');

create policy "Mobideal public delete"
  on storage.objects for delete to public
  using (bucket_id = 'Mobideal');
