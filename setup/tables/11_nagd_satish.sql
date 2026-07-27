-- ============================================================
-- Nağd satış — cash sales ledger
-- Xeyir = satış − alış
-- Xeyir (Faizlə) = xeyir − satıcı faizi
-- ============================================================

create table if not exists public.nagd_satish (
  id uuid primary key default gen_random_uuid(),
  sira_no int,
  tarix date not null default (current_date),
  kime text,
  musteri_id uuid references public.musteriler(id) on delete set null,
  model text,
  imei_1 text,
  imei_2 text,
  serial_no text,
  model_no text,
  reng text,
  yaddas text,
  kimden_alinib text,
  alis_tarixi date,
  alis_qiymeti numeric(12, 2),
  satis_qiymeti numeric(12, 2),
  xeyir numeric(12, 2) generated always as (
    coalesce(satis_qiymeti, 0) - coalesce(alis_qiymeti, 0)
  ) stored,
  satici text,
  satici_faizi numeric(12, 2) not null default 0,
  xeyir_faizle numeric(12, 2) generated always as (
    (coalesce(satis_qiymeti, 0) - coalesce(alis_qiymeti, 0)) - coalesce(satici_faizi, 0)
  ) stored,
  depo_id uuid references public.depo(id) on delete set null,
  kommentler text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_nagd_satish_sira_no on public.nagd_satish (sira_no);
create index if not exists idx_nagd_satish_tarix on public.nagd_satish (tarix);
create index if not exists idx_nagd_satish_kime on public.nagd_satish (kime);
create index if not exists idx_nagd_satish_imei_1 on public.nagd_satish (imei_1);
create index if not exists idx_nagd_satish_depo_id on public.nagd_satish (depo_id);

create or replace function public.nagd_satish_set_sira_no()
returns trigger
language plpgsql
as $$
begin
  if new.sira_no is null then
    select coalesce(max(sira_no), 0) + 1 into new.sira_no from public.nagd_satish;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_nagd_satish_sira_no on public.nagd_satish;
create trigger trg_nagd_satish_sira_no
  before insert on public.nagd_satish
  for each row
  execute function public.nagd_satish_set_sira_no();

alter table public.nagd_satish enable row level security;
drop policy if exists "Allow all for anon" on public.nagd_satish;
create policy "Allow all for anon" on public.nagd_satish for all using (true) with check (true);
