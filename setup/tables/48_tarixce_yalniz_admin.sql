-- ============================================================
-- 48: Dəyişiklik tarixçəsi (change_history) yalnız adminə görünür
--
-- Əvvəl (46): hər işçi tarixçəni oxuya bilirdi (silə / dəyişə bilmirdi).
-- İndi: tarixçəni yalnız admin görür. İşçilərin etdiyi dəyişikliklər
-- əvvəlki kimi avtomatik yazılır (trigger) — sadəcə onlar oxuya bilmir.
-- Saytda «Tarixçə» düyməsi də yalnız adminə görünür.
--
-- Geri qaytarmaq: aşağıdakı «is_admin» sözünü «is_staff» edib yenidən işlədin.
-- ============================================================

begin;

drop policy if exists "Tab: oxu" on public.change_history;
create policy "Tab: oxu" on public.change_history
  for select to authenticated
  using ((select public.is_admin()));

commit;
