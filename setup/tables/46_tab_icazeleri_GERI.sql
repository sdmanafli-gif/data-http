-- 46 GERİ: tab icazələrini ləğv edir, əvvəlki «Staff full access» qaydalarını qaytarır
begin;

-- depo
drop policy if exists "Tab: oxu" on public.depo;
drop policy if exists "Tab: yarat" on public.depo;
drop policy if exists "Tab: dəyiş" on public.depo;
drop policy if exists "Tab: sil" on public.depo;
create policy "Staff full access" on public.depo for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- musteri_bazasi
drop policy if exists "Tab: oxu" on public.musteri_bazasi;
drop policy if exists "Tab: yarat" on public.musteri_bazasi;
drop policy if exists "Tab: dəyiş" on public.musteri_bazasi;
drop policy if exists "Tab: sil" on public.musteri_bazasi;
create policy "Staff full access" on public.musteri_bazasi for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- musteriler
drop policy if exists "Tab: oxu" on public.musteriler;
drop policy if exists "Tab: yarat" on public.musteriler;
drop policy if exists "Tab: dəyiş" on public.musteriler;
drop policy if exists "Tab: sil" on public.musteriler;
create policy "Staff full access" on public.musteriler for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- odenisler
drop policy if exists "Tab: oxu" on public.odenisler;
drop policy if exists "Tab: yarat" on public.odenisler;
drop policy if exists "Tab: dəyiş" on public.odenisler;
drop policy if exists "Tab: sil" on public.odenisler;
create policy "Staff full access" on public.odenisler for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- borc_nisye_ledger
drop policy if exists "Tab: oxu" on public.borc_nisye_ledger;
drop policy if exists "Tab: yarat" on public.borc_nisye_ledger;
drop policy if exists "Tab: dəyiş" on public.borc_nisye_ledger;
drop policy if exists "Tab: sil" on public.borc_nisye_ledger;
create policy "Staff full access" on public.borc_nisye_ledger for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- nagd_satish
drop policy if exists "Tab: oxu" on public.nagd_satish;
drop policy if exists "Tab: yarat" on public.nagd_satish;
drop policy if exists "Tab: dəyiş" on public.nagd_satish;
drop policy if exists "Tab: sil" on public.nagd_satish;
create policy "Staff full access" on public.nagd_satish for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- sexsi_kreditler
drop policy if exists "Tab: oxu" on public.sexsi_kreditler;
drop policy if exists "Tab: yarat" on public.sexsi_kreditler;
drop policy if exists "Tab: dəyiş" on public.sexsi_kreditler;
drop policy if exists "Tab: sil" on public.sexsi_kreditler;
create policy "Staff full access" on public.sexsi_kreditler for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- sexsi_kredit_odenisleri
drop policy if exists "Tab: oxu" on public.sexsi_kredit_odenisleri;
drop policy if exists "Tab: yarat" on public.sexsi_kredit_odenisleri;
drop policy if exists "Tab: dəyiş" on public.sexsi_kredit_odenisleri;
drop policy if exists "Tab: sil" on public.sexsi_kredit_odenisleri;
create policy "Staff full access" on public.sexsi_kredit_odenisleri for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- techizatcilar
drop policy if exists "Tab: oxu" on public.techizatcilar;
drop policy if exists "Tab: yarat" on public.techizatcilar;
drop policy if exists "Tab: dəyiş" on public.techizatcilar;
drop policy if exists "Tab: sil" on public.techizatcilar;
create policy "Staff full access" on public.techizatcilar for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- depo_kateqoriyalar
drop policy if exists "Tab: oxu" on public.depo_kateqoriyalar;
drop policy if exists "Tab: yarat" on public.depo_kateqoriyalar;
drop policy if exists "Tab: dəyiş" on public.depo_kateqoriyalar;
drop policy if exists "Tab: sil" on public.depo_kateqoriyalar;
create policy "Staff full access" on public.depo_kateqoriyalar for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- xercler
drop policy if exists "Tab: oxu" on public.xercler;
drop policy if exists "Tab: yarat" on public.xercler;
drop policy if exists "Tab: dəyiş" on public.xercler;
drop policy if exists "Tab: sil" on public.xercler;
create policy "Staff full access" on public.xercler for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- xerc_kateqoriyalar
drop policy if exists "Tab: oxu" on public.xerc_kateqoriyalar;
drop policy if exists "Tab: yarat" on public.xerc_kateqoriyalar;
drop policy if exists "Tab: dəyiş" on public.xerc_kateqoriyalar;
drop policy if exists "Tab: sil" on public.xerc_kateqoriyalar;
create policy "Staff full access" on public.xerc_kateqoriyalar for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- nomreler
drop policy if exists "Tab: oxu" on public.nomreler;
drop policy if exists "Tab: yarat" on public.nomreler;
drop policy if exists "Tab: dəyiş" on public.nomreler;
drop policy if exists "Tab: sil" on public.nomreler;
create policy "Staff full access" on public.nomreler for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- nomre_balanslar
drop policy if exists "Tab: oxu" on public.nomre_balanslar;
drop policy if exists "Tab: yarat" on public.nomre_balanslar;
drop policy if exists "Tab: dəyiş" on public.nomre_balanslar;
drop policy if exists "Tab: sil" on public.nomre_balanslar;
create policy "Staff full access" on public.nomre_balanslar for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- yigim_qeydler
drop policy if exists "Tab: oxu" on public.yigim_qeydler;
drop policy if exists "Tab: yarat" on public.yigim_qeydler;
drop policy if exists "Tab: dəyiş" on public.yigim_qeydler;
drop policy if exists "Tab: sil" on public.yigim_qeydler;
create policy "Staff full access" on public.yigim_qeydler for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- faiz_cedveli
drop policy if exists "Tab: oxu" on public.faiz_cedveli;
drop policy if exists "Tab: yarat" on public.faiz_cedveli;
drop policy if exists "Tab: dəyiş" on public.faiz_cedveli;
drop policy if exists "Tab: sil" on public.faiz_cedveli;
create policy "Staff full access" on public.faiz_cedveli for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- change_history
drop policy if exists "Tab: oxu" on public.change_history;
drop policy if exists "Tab: yarat" on public.change_history;
drop policy if exists "Tab: dəyiş" on public.change_history;
drop policy if exists "Tab: sil" on public.change_history;
create policy "Staff full access" on public.change_history for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- odenis_kartlar
drop policy if exists "Tab: oxu" on public.odenis_kartlar;
drop policy if exists "Tab: yarat" on public.odenis_kartlar;
drop policy if exists "Tab: dəyiş" on public.odenis_kartlar;
drop policy if exists "Tab: sil" on public.odenis_kartlar;
create policy "Authenticated can manage cards" on public.odenis_kartlar for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
commit;
