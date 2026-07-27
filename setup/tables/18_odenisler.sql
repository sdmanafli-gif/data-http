-- ============================================================
-- Ödənişlər — payments recorded against Müştəri Bazası credits
-- ============================================================
-- tip: ilkin | ayliq | faiz
-- İlkin/Aylıq → update musteri_bazasi.verilib
-- Faiz        → update musteri_bazasi.faiz
-- ============================================================

create table if not exists public.odenisler (
  id uuid primary key default gen_random_uuid(),
  musteri_bazasi_id uuid not null
    references public.musteri_bazasi (id) on delete cascade,
  sira_no int,
  ad_soyad text not null,
  tip text not null
    check (tip in ('ilkin', 'ayliq', 'faiz')),
  mebleg numeric(12, 2) not null
    check (mebleg > 0),
  tarix date not null default (current_date),
  qeyd text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_odenisler_musteri on public.odenisler (musteri_bazasi_id);
create index if not exists idx_odenisler_tarix on public.odenisler (tarix desc nulls last);
create index if not exists idx_odenisler_tip on public.odenisler (tip);
create index if not exists idx_odenisler_sira on public.odenisler (sira_no);

alter table public.odenisler enable row level security;
drop policy if exists "Allow all for anon" on public.odenisler;
create policy "Allow all for anon" on public.odenisler
  for all using (true) with check (true);

-- Change history (if audit helpers already exist)
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'change_history_log'
  ) then
    drop trigger if exists trg_change_history_odenisler on public.odenisler;
    create trigger trg_change_history_odenisler
      after insert or update or delete on public.odenisler
      for each row execute function public.change_history_log();
  end if;
end $$;
