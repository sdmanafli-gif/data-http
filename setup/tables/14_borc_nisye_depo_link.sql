-- Link ledger rows to Depo items sold into Borc / Nisyə
alter table public.borc_nisye_ledger
  add column if not exists depo_id uuid references public.depo(id) on delete set null;

create index if not exists idx_borc_nisye_depo_id on public.borc_nisye_ledger (depo_id);
