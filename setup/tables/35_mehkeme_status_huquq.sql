-- ============================================================
-- Məhkəmə statusu: yeni seçimlər + "Hüquqa Verildi" tarixi
--   Seçimlər: Hüquqa Verildi | Yığım | Məhkəmə Verildi | İddia Təmin edildi
--   huquqa_verilme_tarixi: müştəri Məhkəmə vəziyyətinə düşdüyü gün (avtomatik)
-- ============================================================

begin;

-- 1) Yeni tarix sütunu
alter table public.musteri_bazasi
  add column if not exists huquqa_verilme_tarixi date;

comment on column public.musteri_bazasi.huquqa_verilme_tarixi
  is 'Müştəri Məhkəmə vəziyyətinə düşdüyü tarix (avtomatik, əl ilə dəyişmək olar)';

-- 2) Köhnə status yoxlamasını sil (adı avtomatik verilib — tapıb silirik)
do $$
declare
  c text;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.musteri_bazasi'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%mehkeme_status%'
  loop
    execute format('alter table public.musteri_bazasi drop constraint %I', c);
  end loop;
end $$;

-- 3) Köhnə dəyərləri yenilərə keçir
update public.musteri_bazasi set mehkeme_status = 'Məhkəmə Verildi'    where mehkeme_status = 'Məhkəmə gedir';
update public.musteri_bazasi set mehkeme_status = 'İddia Təmin edildi' where mehkeme_status = 'İcradadır';
update public.musteri_bazasi set mehkeme_status = null                 where mehkeme_status = 'Tamamlanıb';

-- 4) Yeni yoxlama
alter table public.musteri_bazasi
  add constraint musteri_bazasi_mehkeme_status_check check (
    mehkeme_status is null
    or mehkeme_status in ('Hüquqa Verildi', 'Yığım', 'Məhkəmə Verildi', 'İddia Təmin edildi')
  );

comment on column public.musteri_bazasi.mehkeme_status
  is 'Hüquqa Verildi | Yığım | Məhkəmə Verildi | İddia Təmin edildi';

-- 5) Avtomatik: Məhkəmə vəziyyətinə düşəndə tarix (Bakı vaxtı ilə bu gün)
--    və status boşdursa "Hüquqa Verildi"
create or replace function public.musteri_bazasi_mehkeme_tarix()
returns trigger
language plpgsql
as $$
begin
  if new.veziyyet = 'Məhkəmə'
     and (tg_op = 'INSERT' or old.veziyyet is distinct from 'Məhkəmə') then
    -- əl ilə eyni anda başqa tarix yazılmayıbsa, bu günü yaz
    if tg_op = 'INSERT' then
      new.huquqa_verilme_tarixi := coalesce(new.huquqa_verilme_tarixi, (now() at time zone 'Asia/Baku')::date);
    elsif new.huquqa_verilme_tarixi is not distinct from old.huquqa_verilme_tarixi then
      new.huquqa_verilme_tarixi := (now() at time zone 'Asia/Baku')::date;
    end if;
    if new.mehkeme_status is null then
      new.mehkeme_status := 'Hüquqa Verildi';
    end if;
  end if;
  return new;
end;
$$;

-- "zz" adı: vəziyyət triggerindən (trg_musteri_bazasi_veziyyet) sonra işləsin
drop trigger if exists trg_musteri_bazasi_zz_mehkeme_tarix on public.musteri_bazasi;
create trigger trg_musteri_bazasi_zz_mehkeme_tarix
  before insert or update on public.musteri_bazasi
  for each row
  execute function public.musteri_bazasi_mehkeme_tarix();

-- 6) Köhnə qeydlər: tarixçədə Məhkəmə-yə keçid tarixi olanlara həmin günü yaz
--    (Excel-dən birbaşa Məhkəmə kimi gələnlər boş qalır)
update public.musteri_bazasi mb
   set huquqa_verilme_tarixi = h.gun
  from (
    select distinct on (record_id)
           record_id,
           (created_at at time zone 'Asia/Baku')::date as gun
      from public.change_history
     where table_name = 'musteri_bazasi'
       and changes -> 'veziyyet' ->> 'new' = 'Məhkəmə'
     order by record_id, created_at desc
  ) h
 where mb.id = h.record_id
   and mb.veziyyet = 'Məhkəmə'
   and mb.huquqa_verilme_tarixi is null;

commit;
