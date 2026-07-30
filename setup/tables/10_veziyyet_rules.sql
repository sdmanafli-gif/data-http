-- Vəziyyət auto:
-- - never overwrite Məhkəmə
-- - Bitib when alış = 0 and satış = 0
-- - Bitib when qalan borc = 0 (verilib >= satış and satış > 0)
-- - otherwise Qalıb
alter table public.musteri_bazasi
  add column if not exists veziyyet_manual boolean not null default false;

alter table public.musteri_bazasi
  alter column veziyyet set default 'Qalıb';

update public.musteri_bazasi
set veziyyet = 'Qalıb'
where veziyyet is null;

create or replace function public.musteri_bazasi_sync_veziyyet()
returns trigger
language plpgsql
as $$
begin
  -- Never auto-change Məhkəmə
  if new.veziyyet = 'Məhkəmə' then
    new.veziyyet_manual := true;
    return new;
  end if;

  -- Alış and satış both 0 (or null) → Bitib
  if coalesce(new.alis_qiymeti, 0) = 0
     and coalesce(new.satis_qiymeti, 0) = 0 then
    new.veziyyet := 'Bitib';
    new.veziyyet_manual := false;
    return new;
  end if;

  -- Qalıb → Bitib when qalan borc = 0 (verilib >= satış)
  if new.satis_qiymeti is not null
     and new.satis_qiymeti > 0
     and coalesce(new.verilib, 0) >= new.satis_qiymeti then
    new.veziyyet := 'Bitib';
    new.veziyyet_manual := false;
  else
    new.veziyyet := 'Qalıb';
    new.veziyyet_manual := false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_musteri_bazasi_veziyyet on public.musteri_bazasi;
create trigger trg_musteri_bazasi_veziyyet
  before insert or update of verilib, satis_qiymeti, alis_qiymeti, veziyyet, veziyyet_manual
  on public.musteri_bazasi
  for each row
  execute function public.musteri_bazasi_sync_veziyyet();

-- Backfill existing rows (skip Məhkəmə)
update public.musteri_bazasi
set veziyyet = 'Bitib',
    veziyyet_manual = false,
    updated_at = now()
where coalesce(veziyyet, '') <> 'Məhkəmə'
  and coalesce(alis_qiymeti, 0) = 0
  and coalesce(satis_qiymeti, 0) = 0
  and coalesce(veziyyet, '') <> 'Bitib';
