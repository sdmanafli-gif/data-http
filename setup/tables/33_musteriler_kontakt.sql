-- ============================================================
-- Kontaktlar: müştəri kartı üçün əlavə sahələr (yalnız yeni boş sütunlar)
-- Mövcud məlumatlara toxunmur.
-- ============================================================

alter table public.musteriler
  add column if not exists sexsi_nomre_1 text,
  add column if not exists sexsi_nomre_2 text,
  add column if not exists zamin_nomre text,
  add column if not exists sv_seriya text,
  add column if not exists fin_kod text,
  add column if not exists dogum_tarixi date,
  add column if not exists qeydiyyat_unvani text,
  add column if not exists yasayis_unvani text,
  add column if not exists sv_verilme_tarixi date,
  add column if not exists sv_bitme_tarixi date,
  add column if not exists senedler jsonb not null default '[]'::jsonb;

-- ------------------------------------------------------------
-- Şəxsiyyət vəsiqəsi faylları üçün MƏXFİ bucket (açıq link yoxdur).
-- Yalnız sayta daxil olmuş admin və ya Kontaktlar icazəsi olan istifadəçi
-- faylı yükləyə / aça (müvəqqəti link) / silə bilər.
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('mobideal-sexsi', 'mobideal-sexsi', false)
on conflict (id) do update set public = false;

create or replace function public.can_access_kontaktlar()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and (
         p.role = 'admin'
         or coalesce((p.permissions -> 'tabs' -> 'kontaktlar' ->> 'visible')::boolean, false)
       )
  );
$$;

drop policy if exists "mobideal-sexsi select" on storage.objects;
drop policy if exists "mobideal-sexsi insert" on storage.objects;
drop policy if exists "mobideal-sexsi delete" on storage.objects;

create policy "mobideal-sexsi select"
  on storage.objects for select to authenticated
  using (bucket_id = 'mobideal-sexsi' and public.can_access_kontaktlar());

create policy "mobideal-sexsi insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'mobideal-sexsi' and public.can_access_kontaktlar());

create policy "mobideal-sexsi delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'mobideal-sexsi' and public.can_access_kontaktlar());
