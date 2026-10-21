-- ============================================================
-- Məhkəmə tarixləri: "Məhkəməyə Verildi" və "İddia Təmin edildi"
--   mehkemeye_verilme_tarixi: status "Məhkəmə Verildi" seçiləndə (avtomatik)
--   iddia_temin_tarixi:       status "İddia Təmin edildi" seçiləndə (avtomatik)
--   huquqa_verilme_tarixi:    vəziyyət "Məhkəmə" olanda (avtomatik, 35-ci fayl)
-- Bu 3 tarixi əl ilə YALNIZ admin dəyişə bilər; digər istifadəçinin
-- əl ilə dəyişikliyi bazada nəzərə alınmır (köhnə dəyər qalır).
-- ============================================================

begin;

alter table public.musteri_bazasi
  add column if not exists mehkemeye_verilme_tarixi date,
  add column if not exists iddia_temin_tarixi date;

create or replace function public.musteri_bazasi_mehkeme_tarix()
returns trigger
language plpgsql
as $$
declare
  bu_gun date := (now() at time zone 'Asia/Baku')::date;
  -- auth.uid() boşdursa: birbaşa SQL / backup (sayt istifadəçisi deyil)
  admin_ola_biler boolean := auth.uid() is null or public.is_admin();
begin
  -- 1) Admin deyilsə, tarixlərə əl ilə toxunmaq olmaz
  if not admin_ola_biler then
    if tg_op = 'INSERT' then
      new.huquqa_verilme_tarixi := null;
      new.mehkemeye_verilme_tarixi := null;
      new.iddia_temin_tarixi := null;
    else
      new.huquqa_verilme_tarixi := old.huquqa_verilme_tarixi;
      new.mehkemeye_verilme_tarixi := old.mehkemeye_verilme_tarixi;
      new.iddia_temin_tarixi := old.iddia_temin_tarixi;
    end if;
  end if;

  -- 2) Hüquqa Verildi: vəziyyət Məhkəmə-yə keçəndə
  if new.veziyyet = 'Məhkəmə'
     and (tg_op = 'INSERT' or old.veziyyet is distinct from 'Məhkəmə') then
    if new.huquqa_verilme_tarixi is null
       or (tg_op = 'UPDATE' and new.huquqa_verilme_tarixi is not distinct from old.huquqa_verilme_tarixi) then
      new.huquqa_verilme_tarixi := bu_gun;
    end if;
    if new.mehkeme_status is null then
      new.mehkeme_status := 'Hüquqa Verildi';
    end if;
  end if;

  -- 3) Məhkəməyə Verildi: status "Məhkəmə Verildi"-yə keçəndə
  if new.mehkeme_status = 'Məhkəmə Verildi'
     and (tg_op = 'INSERT' or old.mehkeme_status is distinct from 'Məhkəmə Verildi') then
    if new.mehkemeye_verilme_tarixi is null
       or (tg_op = 'UPDATE' and new.mehkemeye_verilme_tarixi is not distinct from old.mehkemeye_verilme_tarixi) then
      new.mehkemeye_verilme_tarixi := bu_gun;
    end if;
  end if;

  -- 4) İddia Təmin edildi: status "İddia Təmin edildi"-yə keçəndə
  if new.mehkeme_status = 'İddia Təmin edildi'
     and (tg_op = 'INSERT' or old.mehkeme_status is distinct from 'İddia Təmin edildi') then
    if new.iddia_temin_tarixi is null
       or (tg_op = 'UPDATE' and new.iddia_temin_tarixi is not distinct from old.iddia_temin_tarixi) then
      new.iddia_temin_tarixi := bu_gun;
    end if;
  end if;

  return new;
end;
$$;

-- Köhnə 2 qeyd: tarixçədəki ilk status dəyişikliyi günü
update public.musteri_bazasi mb
   set mehkemeye_verilme_tarixi = h.gun
  from (
    select distinct on (record_id) record_id, (created_at at time zone 'Asia/Baku')::date as gun
      from public.change_history
     where table_name = 'musteri_bazasi'
       and changes -> 'mehkeme_status' ->> 'new' in ('Məhkəmə gedir', 'Məhkəmə Verildi')
     order by record_id, created_at asc
  ) h
 where mb.id = h.record_id
   and mb.mehkeme_status = 'Məhkəmə Verildi'
   and mb.mehkemeye_verilme_tarixi is null;

update public.musteri_bazasi mb
   set iddia_temin_tarixi = h.gun
  from (
    select distinct on (record_id) record_id, (created_at at time zone 'Asia/Baku')::date as gun
      from public.change_history
     where table_name = 'musteri_bazasi'
       and changes -> 'mehkeme_status' ->> 'new' in ('İcradadır', 'İddia Təmin edildi')
     order by record_id, created_at asc
  ) h
 where mb.id = h.record_id
   and mb.mehkeme_status = 'İddia Təmin edildi'
   and mb.iddia_temin_tarixi is null;

commit;
