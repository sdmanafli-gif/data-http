-- ============================================================
-- 46 TEST: heç nəyi dəyişmir. 46-nı müvəqqəti tətbiq edir, 3 istifadəçi kimi yoxlayır,
-- sonra xəta ilə hər şeyi GERİ QAYTARIR. Nəticə xəta mesajında görünür: «NETICE: ...»
-- ============================================================

begin;

create or replace function public.tab_icaze(tabs text[], flag text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when p.role = 'admin' then true
      else exists (
        select 1
          from unnest(tabs) as x(tab)
         where case
                 when jsonb_typeof(p.permissions -> 'tabs' -> x.tab) is distinct from 'object'
                   then x.tab not in ('kontaktlar', 'nomreler', 'analitika', 'xercler', 'qiymet-cedveli')
                 else
                   coalesce(p.permissions -> 'tabs' -> x.tab ->> 'visible', 'true') <> 'false'
                   and coalesce(p.permissions -> 'tabs' -> x.tab ->> 'canView', 'true') <> 'false'
                   and case flag
                         when 'canView' then true
                         when 'canWrite' then
                           coalesce(p.permissions -> 'tabs' -> x.tab ->> 'canCreate', 'true') <> 'false'
                           or coalesce(p.permissions -> 'tabs' -> x.tab ->> 'canEdit', 'true') <> 'false'
                         else coalesce(p.permissions -> 'tabs' -> x.tab ->> flag, 'true') <> 'false'
                       end
               end
      )
    end
      from public.profiles p
     where p.id = auth.uid()
  ), false);
$$;

revoke all on function public.tab_icaze(text[], text) from public, anon;
grant execute on function public.tab_icaze(text[], text) to authenticated;



-- depo
alter table public.depo enable row level security;
drop policy if exists "Staff full access" on public.depo;
drop policy if exists "Allow all for anon" on public.depo;
drop policy if exists "Authenticated can manage cards" on public.depo;
drop policy if exists "Tab: oxu" on public.depo;
drop policy if exists "Tab: yarat" on public.depo;
drop policy if exists "Tab: dəyiş" on public.depo;
drop policy if exists "Tab: sil" on public.depo;
create policy "Tab: oxu" on public.depo for select to authenticated using (select public.tab_icaze(array['depo', 'musteri-bazasi', 'kontaktlar', 'analitika'], 'canView'));
create policy "Tab: yarat" on public.depo for insert to authenticated with check (select public.tab_icaze(array['depo', 'musteri-bazasi'], 'canWrite'));
create policy "Tab: dəyiş" on public.depo for update to authenticated using (select public.tab_icaze(array['depo', 'musteri-bazasi', 'kontaktlar'], 'canWrite')) with check (select public.tab_icaze(array['depo', 'musteri-bazasi', 'kontaktlar'], 'canWrite'));
create policy "Tab: sil" on public.depo for delete to authenticated using (select public.tab_icaze(array['depo'], 'canDelete'));

-- musteri_bazasi
alter table public.musteri_bazasi enable row level security;
drop policy if exists "Staff full access" on public.musteri_bazasi;
drop policy if exists "Allow all for anon" on public.musteri_bazasi;
drop policy if exists "Authenticated can manage cards" on public.musteri_bazasi;
drop policy if exists "Tab: oxu" on public.musteri_bazasi;
drop policy if exists "Tab: yarat" on public.musteri_bazasi;
drop policy if exists "Tab: dəyiş" on public.musteri_bazasi;
drop policy if exists "Tab: sil" on public.musteri_bazasi;
create policy "Tab: oxu" on public.musteri_bazasi for select to authenticated using (select public.tab_icaze(array['musteri-bazasi', 'mehkeme', 'yigim', 'odenisler', 'depo', 'analitika', 'kontaktlar', 'xercler', 'borc-nisye'], 'canView'));
create policy "Tab: yarat" on public.musteri_bazasi for insert to authenticated with check (select public.tab_icaze(array['musteri-bazasi', 'depo'], 'canWrite'));
create policy "Tab: dəyiş" on public.musteri_bazasi for update to authenticated using (select public.tab_icaze(array['musteri-bazasi', 'mehkeme', 'yigim', 'odenisler', 'depo', 'kontaktlar'], 'canWrite')) with check (select public.tab_icaze(array['musteri-bazasi', 'mehkeme', 'yigim', 'odenisler', 'depo', 'kontaktlar'], 'canWrite'));
create policy "Tab: sil" on public.musteri_bazasi for delete to authenticated using (select public.tab_icaze(array['musteri-bazasi'], 'canDelete'));

-- musteriler
alter table public.musteriler enable row level security;
drop policy if exists "Staff full access" on public.musteriler;
drop policy if exists "Allow all for anon" on public.musteriler;
drop policy if exists "Authenticated can manage cards" on public.musteriler;
drop policy if exists "Tab: oxu" on public.musteriler;
drop policy if exists "Tab: yarat" on public.musteriler;
drop policy if exists "Tab: dəyiş" on public.musteriler;
drop policy if exists "Tab: sil" on public.musteriler;
create policy "Tab: oxu" on public.musteriler for select to authenticated using (select public.tab_icaze(array['musteri-bazasi', 'mehkeme', 'yigim', 'odenisler', 'depo', 'kontaktlar', 'borc-nisye'], 'canView'));
create policy "Tab: yarat" on public.musteriler for insert to authenticated with check (select public.tab_icaze(array['musteri-bazasi', 'depo', 'kontaktlar'], 'canWrite'));
create policy "Tab: dəyiş" on public.musteriler for update to authenticated using (select public.tab_icaze(array['musteri-bazasi', 'depo', 'kontaktlar'], 'canWrite')) with check (select public.tab_icaze(array['musteri-bazasi', 'depo', 'kontaktlar'], 'canWrite'));
create policy "Tab: sil" on public.musteriler for delete to authenticated using (select public.tab_icaze(array['kontaktlar'], 'canDelete'));

-- odenisler
alter table public.odenisler enable row level security;
drop policy if exists "Staff full access" on public.odenisler;
drop policy if exists "Allow all for anon" on public.odenisler;
drop policy if exists "Authenticated can manage cards" on public.odenisler;
drop policy if exists "Tab: oxu" on public.odenisler;
drop policy if exists "Tab: yarat" on public.odenisler;
drop policy if exists "Tab: dəyiş" on public.odenisler;
drop policy if exists "Tab: sil" on public.odenisler;
create policy "Tab: oxu" on public.odenisler for select to authenticated using (select public.tab_icaze(array['odenisler', 'musteri-bazasi', 'mehkeme', 'yigim', 'depo', 'analitika', 'kontaktlar', 'borc-nisye'], 'canView'));
create policy "Tab: yarat" on public.odenisler for insert to authenticated with check (select public.tab_icaze(array['odenisler', 'depo'], 'canWrite'));
create policy "Tab: dəyiş" on public.odenisler for update to authenticated using (select public.tab_icaze(array['odenisler'], 'canWrite')) with check (select public.tab_icaze(array['odenisler'], 'canWrite'));
create policy "Tab: sil" on public.odenisler for delete to authenticated using (select public.tab_icaze(array['odenisler', 'musteri-bazasi', 'mehkeme', 'yigim'], 'canDelete'));

-- borc_nisye_ledger
alter table public.borc_nisye_ledger enable row level security;
drop policy if exists "Staff full access" on public.borc_nisye_ledger;
drop policy if exists "Allow all for anon" on public.borc_nisye_ledger;
drop policy if exists "Authenticated can manage cards" on public.borc_nisye_ledger;
drop policy if exists "Tab: oxu" on public.borc_nisye_ledger;
drop policy if exists "Tab: yarat" on public.borc_nisye_ledger;
drop policy if exists "Tab: dəyiş" on public.borc_nisye_ledger;
drop policy if exists "Tab: sil" on public.borc_nisye_ledger;
create policy "Tab: oxu" on public.borc_nisye_ledger for select to authenticated using (select public.tab_icaze(array['borc-nisye', 'depo', 'analitika', 'kontaktlar', 'odenisler', 'musteri-bazasi', 'mehkeme', 'yigim'], 'canView'));
create policy "Tab: yarat" on public.borc_nisye_ledger for insert to authenticated with check (select public.tab_icaze(array['borc-nisye', 'depo'], 'canWrite'));
create policy "Tab: dəyiş" on public.borc_nisye_ledger for update to authenticated using (select public.tab_icaze(array['borc-nisye', 'depo', 'kontaktlar'], 'canWrite')) with check (select public.tab_icaze(array['borc-nisye', 'depo', 'kontaktlar'], 'canWrite'));
create policy "Tab: sil" on public.borc_nisye_ledger for delete to authenticated using (select public.tab_icaze(array['borc-nisye', 'depo'], 'canDelete'));

-- nagd_satish
alter table public.nagd_satish enable row level security;
drop policy if exists "Staff full access" on public.nagd_satish;
drop policy if exists "Allow all for anon" on public.nagd_satish;
drop policy if exists "Authenticated can manage cards" on public.nagd_satish;
drop policy if exists "Tab: oxu" on public.nagd_satish;
drop policy if exists "Tab: yarat" on public.nagd_satish;
drop policy if exists "Tab: dəyiş" on public.nagd_satish;
drop policy if exists "Tab: sil" on public.nagd_satish;
create policy "Tab: oxu" on public.nagd_satish for select to authenticated using (select public.tab_icaze(array['nagd-satish', 'analitika', 'xercler', 'depo'], 'canView'));
create policy "Tab: yarat" on public.nagd_satish for insert to authenticated with check (select public.tab_icaze(array['nagd-satish', 'depo'], 'canWrite'));
create policy "Tab: dəyiş" on public.nagd_satish for update to authenticated using (select public.tab_icaze(array['nagd-satish'], 'canWrite')) with check (select public.tab_icaze(array['nagd-satish'], 'canWrite'));
create policy "Tab: sil" on public.nagd_satish for delete to authenticated using (select public.tab_icaze(array['nagd-satish'], 'canDelete'));

-- sexsi_kreditler
alter table public.sexsi_kreditler enable row level security;
drop policy if exists "Staff full access" on public.sexsi_kreditler;
drop policy if exists "Allow all for anon" on public.sexsi_kreditler;
drop policy if exists "Authenticated can manage cards" on public.sexsi_kreditler;
drop policy if exists "Tab: oxu" on public.sexsi_kreditler;
drop policy if exists "Tab: yarat" on public.sexsi_kreditler;
drop policy if exists "Tab: dəyiş" on public.sexsi_kreditler;
drop policy if exists "Tab: sil" on public.sexsi_kreditler;
create policy "Tab: oxu" on public.sexsi_kreditler for select to authenticated using (select public.tab_icaze(array['borc-nisye'], 'canView'));
create policy "Tab: yarat" on public.sexsi_kreditler for insert to authenticated with check (select public.tab_icaze(array['borc-nisye'], 'canWrite'));
create policy "Tab: dəyiş" on public.sexsi_kreditler for update to authenticated using (select public.tab_icaze(array['borc-nisye'], 'canWrite')) with check (select public.tab_icaze(array['borc-nisye'], 'canWrite'));
create policy "Tab: sil" on public.sexsi_kreditler for delete to authenticated using (select public.tab_icaze(array['borc-nisye'], 'canDelete'));

-- sexsi_kredit_odenisleri
alter table public.sexsi_kredit_odenisleri enable row level security;
drop policy if exists "Staff full access" on public.sexsi_kredit_odenisleri;
drop policy if exists "Allow all for anon" on public.sexsi_kredit_odenisleri;
drop policy if exists "Authenticated can manage cards" on public.sexsi_kredit_odenisleri;
drop policy if exists "Tab: oxu" on public.sexsi_kredit_odenisleri;
drop policy if exists "Tab: yarat" on public.sexsi_kredit_odenisleri;
drop policy if exists "Tab: dəyiş" on public.sexsi_kredit_odenisleri;
drop policy if exists "Tab: sil" on public.sexsi_kredit_odenisleri;
create policy "Tab: oxu" on public.sexsi_kredit_odenisleri for select to authenticated using (select public.tab_icaze(array['borc-nisye'], 'canView'));
create policy "Tab: yarat" on public.sexsi_kredit_odenisleri for insert to authenticated with check (select public.tab_icaze(array['borc-nisye'], 'canWrite'));
create policy "Tab: dəyiş" on public.sexsi_kredit_odenisleri for update to authenticated using (select public.tab_icaze(array['borc-nisye'], 'canWrite')) with check (select public.tab_icaze(array['borc-nisye'], 'canWrite'));
create policy "Tab: sil" on public.sexsi_kredit_odenisleri for delete to authenticated using (select public.tab_icaze(array['borc-nisye'], 'canDelete'));

-- techizatcilar
alter table public.techizatcilar enable row level security;
drop policy if exists "Staff full access" on public.techizatcilar;
drop policy if exists "Allow all for anon" on public.techizatcilar;
drop policy if exists "Authenticated can manage cards" on public.techizatcilar;
drop policy if exists "Tab: oxu" on public.techizatcilar;
drop policy if exists "Tab: yarat" on public.techizatcilar;
drop policy if exists "Tab: dəyiş" on public.techizatcilar;
drop policy if exists "Tab: sil" on public.techizatcilar;
create policy "Tab: oxu" on public.techizatcilar for select to authenticated using (select public.tab_icaze(array['depo', 'kontaktlar', 'borc-nisye', 'odenisler', 'musteri-bazasi', 'mehkeme', 'yigim'], 'canView'));
create policy "Tab: yarat" on public.techizatcilar for insert to authenticated with check (select public.tab_icaze(array['depo', 'kontaktlar'], 'canWrite'));
create policy "Tab: dəyiş" on public.techizatcilar for update to authenticated using (select public.tab_icaze(array['depo', 'kontaktlar'], 'canWrite')) with check (select public.tab_icaze(array['depo', 'kontaktlar'], 'canWrite'));
create policy "Tab: sil" on public.techizatcilar for delete to authenticated using (select public.tab_icaze(array['kontaktlar'], 'canDelete'));

-- depo_kateqoriyalar
alter table public.depo_kateqoriyalar enable row level security;
drop policy if exists "Staff full access" on public.depo_kateqoriyalar;
drop policy if exists "Allow all for anon" on public.depo_kateqoriyalar;
drop policy if exists "Authenticated can manage cards" on public.depo_kateqoriyalar;
drop policy if exists "Tab: oxu" on public.depo_kateqoriyalar;
drop policy if exists "Tab: yarat" on public.depo_kateqoriyalar;
drop policy if exists "Tab: dəyiş" on public.depo_kateqoriyalar;
drop policy if exists "Tab: sil" on public.depo_kateqoriyalar;
create policy "Tab: oxu" on public.depo_kateqoriyalar for select to authenticated using (select public.tab_icaze(array['depo'], 'canView'));
create policy "Tab: yarat" on public.depo_kateqoriyalar for insert to authenticated with check (select public.tab_icaze(array['depo'], 'canWrite'));
create policy "Tab: dəyiş" on public.depo_kateqoriyalar for update to authenticated using (select public.tab_icaze(array['depo'], 'canWrite')) with check (select public.tab_icaze(array['depo'], 'canWrite'));
create policy "Tab: sil" on public.depo_kateqoriyalar for delete to authenticated using (select public.tab_icaze(array['depo'], 'canDelete'));

-- xercler
alter table public.xercler enable row level security;
drop policy if exists "Staff full access" on public.xercler;
drop policy if exists "Allow all for anon" on public.xercler;
drop policy if exists "Authenticated can manage cards" on public.xercler;
drop policy if exists "Tab: oxu" on public.xercler;
drop policy if exists "Tab: yarat" on public.xercler;
drop policy if exists "Tab: dəyiş" on public.xercler;
drop policy if exists "Tab: sil" on public.xercler;
create policy "Tab: oxu" on public.xercler for select to authenticated using (select public.tab_icaze(array['xercler', 'analitika'], 'canView'));
create policy "Tab: yarat" on public.xercler for insert to authenticated with check (select public.tab_icaze(array['xercler'], 'canWrite'));
create policy "Tab: dəyiş" on public.xercler for update to authenticated using (select public.tab_icaze(array['xercler'], 'canWrite')) with check (select public.tab_icaze(array['xercler'], 'canWrite'));
create policy "Tab: sil" on public.xercler for delete to authenticated using (select public.tab_icaze(array['xercler'], 'canDelete'));

-- xerc_kateqoriyalar
alter table public.xerc_kateqoriyalar enable row level security;
drop policy if exists "Staff full access" on public.xerc_kateqoriyalar;
drop policy if exists "Allow all for anon" on public.xerc_kateqoriyalar;
drop policy if exists "Authenticated can manage cards" on public.xerc_kateqoriyalar;
drop policy if exists "Tab: oxu" on public.xerc_kateqoriyalar;
drop policy if exists "Tab: yarat" on public.xerc_kateqoriyalar;
drop policy if exists "Tab: dəyiş" on public.xerc_kateqoriyalar;
drop policy if exists "Tab: sil" on public.xerc_kateqoriyalar;
create policy "Tab: oxu" on public.xerc_kateqoriyalar for select to authenticated using (select public.tab_icaze(array['xercler'], 'canView'));
create policy "Tab: yarat" on public.xerc_kateqoriyalar for insert to authenticated with check (select public.tab_icaze(array['xercler'], 'canWrite'));
create policy "Tab: dəyiş" on public.xerc_kateqoriyalar for update to authenticated using (select public.tab_icaze(array['xercler'], 'canWrite')) with check (select public.tab_icaze(array['xercler'], 'canWrite'));
create policy "Tab: sil" on public.xerc_kateqoriyalar for delete to authenticated using (select public.tab_icaze(array['xercler'], 'canDelete'));

-- nomreler
alter table public.nomreler enable row level security;
drop policy if exists "Staff full access" on public.nomreler;
drop policy if exists "Allow all for anon" on public.nomreler;
drop policy if exists "Authenticated can manage cards" on public.nomreler;
drop policy if exists "Tab: oxu" on public.nomreler;
drop policy if exists "Tab: yarat" on public.nomreler;
drop policy if exists "Tab: dəyiş" on public.nomreler;
drop policy if exists "Tab: sil" on public.nomreler;
create policy "Tab: oxu" on public.nomreler for select to authenticated using (select public.tab_icaze(array['nomreler', 'analitika'], 'canView'));
create policy "Tab: yarat" on public.nomreler for insert to authenticated with check (select public.tab_icaze(array['nomreler'], 'canWrite'));
create policy "Tab: dəyiş" on public.nomreler for update to authenticated using (select public.tab_icaze(array['nomreler'], 'canWrite')) with check (select public.tab_icaze(array['nomreler'], 'canWrite'));
create policy "Tab: sil" on public.nomreler for delete to authenticated using (select public.tab_icaze(array['nomreler'], 'canDelete'));

-- nomre_balanslar
alter table public.nomre_balanslar enable row level security;
drop policy if exists "Staff full access" on public.nomre_balanslar;
drop policy if exists "Allow all for anon" on public.nomre_balanslar;
drop policy if exists "Authenticated can manage cards" on public.nomre_balanslar;
drop policy if exists "Tab: oxu" on public.nomre_balanslar;
drop policy if exists "Tab: yarat" on public.nomre_balanslar;
drop policy if exists "Tab: dəyiş" on public.nomre_balanslar;
drop policy if exists "Tab: sil" on public.nomre_balanslar;
create policy "Tab: oxu" on public.nomre_balanslar for select to authenticated using (select public.tab_icaze(array['nomreler', 'analitika'], 'canView'));
create policy "Tab: yarat" on public.nomre_balanslar for insert to authenticated with check (select public.tab_icaze(array['nomreler'], 'canWrite'));
create policy "Tab: dəyiş" on public.nomre_balanslar for update to authenticated using (select public.tab_icaze(array['nomreler'], 'canWrite')) with check (select public.tab_icaze(array['nomreler'], 'canWrite'));
create policy "Tab: sil" on public.nomre_balanslar for delete to authenticated using (select public.tab_icaze(array['nomreler'], 'canDelete'));

-- yigim_qeydler
alter table public.yigim_qeydler enable row level security;
drop policy if exists "Staff full access" on public.yigim_qeydler;
drop policy if exists "Allow all for anon" on public.yigim_qeydler;
drop policy if exists "Authenticated can manage cards" on public.yigim_qeydler;
drop policy if exists "Tab: oxu" on public.yigim_qeydler;
drop policy if exists "Tab: yarat" on public.yigim_qeydler;
drop policy if exists "Tab: dəyiş" on public.yigim_qeydler;
drop policy if exists "Tab: sil" on public.yigim_qeydler;
create policy "Tab: oxu" on public.yigim_qeydler for select to authenticated using (select public.tab_icaze(array['yigim'], 'canView'));
create policy "Tab: yarat" on public.yigim_qeydler for insert to authenticated with check (select public.tab_icaze(array['yigim'], 'canWrite'));
create policy "Tab: dəyiş" on public.yigim_qeydler for update to authenticated using (select public.tab_icaze(array['yigim'], 'canWrite')) with check (select public.tab_icaze(array['yigim'], 'canWrite'));
create policy "Tab: sil" on public.yigim_qeydler for delete to authenticated using (select public.tab_icaze(array['yigim'], 'canDelete'));

-- faiz_cedveli
alter table public.faiz_cedveli enable row level security;
drop policy if exists "Staff full access" on public.faiz_cedveli;
drop policy if exists "Allow all for anon" on public.faiz_cedveli;
drop policy if exists "Authenticated can manage cards" on public.faiz_cedveli;
drop policy if exists "Tab: oxu" on public.faiz_cedveli;
drop policy if exists "Tab: yarat" on public.faiz_cedveli;
drop policy if exists "Tab: dəyiş" on public.faiz_cedveli;
drop policy if exists "Tab: sil" on public.faiz_cedveli;
create policy "Tab: oxu" on public.faiz_cedveli for select to authenticated using (select public.is_staff());
create policy "Tab: yarat" on public.faiz_cedveli for insert to authenticated with check (select public.is_admin());
create policy "Tab: dəyiş" on public.faiz_cedveli for update to authenticated using (select public.is_admin()) with check (select public.is_admin());
create policy "Tab: sil" on public.faiz_cedveli for delete to authenticated using (select public.is_admin());

-- change_history
alter table public.change_history enable row level security;
drop policy if exists "Staff full access" on public.change_history;
drop policy if exists "Allow all for anon" on public.change_history;
drop policy if exists "Authenticated can manage cards" on public.change_history;
drop policy if exists "Tab: oxu" on public.change_history;
drop policy if exists "Tab: yarat" on public.change_history;
drop policy if exists "Tab: dəyiş" on public.change_history;
drop policy if exists "Tab: sil" on public.change_history;
create policy "Tab: oxu" on public.change_history for select to authenticated using (select public.is_staff());
create policy "Tab: yarat" on public.change_history for insert to authenticated with check (select public.is_admin());
create policy "Tab: dəyiş" on public.change_history for update to authenticated using (select public.is_admin()) with check (select public.is_admin());
create policy "Tab: sil" on public.change_history for delete to authenticated using (select public.is_admin());

-- odenis_kartlar
alter table public.odenis_kartlar enable row level security;
drop policy if exists "Staff full access" on public.odenis_kartlar;
drop policy if exists "Allow all for anon" on public.odenis_kartlar;
drop policy if exists "Authenticated can manage cards" on public.odenis_kartlar;
drop policy if exists "Tab: oxu" on public.odenis_kartlar;
drop policy if exists "Tab: yarat" on public.odenis_kartlar;
drop policy if exists "Tab: dəyiş" on public.odenis_kartlar;
drop policy if exists "Tab: sil" on public.odenis_kartlar;
create policy "Tab: oxu" on public.odenis_kartlar for select to authenticated using (select public.is_staff());
create policy "Tab: yarat" on public.odenis_kartlar for insert to authenticated with check (select public.tab_icaze(array['odenisler'], 'canWrite'));
create policy "Tab: dəyiş" on public.odenis_kartlar for update to authenticated using (select public.is_admin()) with check (select public.is_admin());
create policy "Tab: sil" on public.odenis_kartlar for delete to authenticated using (select public.is_admin());

do $t$
declare r text := ''; u record; t text; n bigint;
begin
  for u in select p.id, a.email from public.profiles p join auth.users a on a.id = p.id
            where a.email in ('mobideal.az@gmail.com','sarxanmustafayev88@gmail.com','xtramen221@gmail.com') order by a.email loop
    perform set_config('request.jwt.claims', json_build_object('sub', u.id, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    r := r || ' ## ' || split_part(u.email, '@', 1) || ':';
    foreach t in array array['depo','musteri_bazasi','musteriler','odenisler','borc_nisye_ledger','nagd_satish','sexsi_kreditler','techizatcilar','depo_kateqoriyalar','xercler','nomreler','yigim_qeydler','change_history','odenis_kartlar'] loop
      execute format('select count(*) from public.%I', t) into n;
      r := r || ' ' || t || '=' || n;
    end loop;
    execute 'update public.depo set id = id where id = (select min(id) from public.depo)';
    get diagnostics n = row_count; r := r || ' | depoUPD=' || n;
    execute 'update public.xercler set id = id where id = (select min(id) from public.xercler)';
    get diagnostics n = row_count; r := r || ' xercUPD=' || n;
    execute 'delete from public.change_history where id = (select min(id) from public.change_history)';
    get diagnostics n = row_count; r := r || ' histDEL=' || n;
    begin
      execute 'update public.profiles set permissions = ''{}''::jsonb where id = auth.uid()';
      get diagnostics n = row_count; r := r || ' permUPD=' || n;
    exception when others then r := r || ' permUPD=BLOK';
    end;
    execute 'reset role';
  end loop;
  raise exception 'NETICE:%', r;
end $t$;

rollback;
