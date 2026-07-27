-- ============================================================
-- Borc / Nisyə — return / payment due date
-- ============================================================
-- tarix = when money/goods moved
-- qaytarma_tarixi = when return / payment should happen
-- ============================================================

alter table public.borc_nisye_ledger
  add column if not exists qaytarma_tarixi date;

create index if not exists idx_borc_nisye_qaytarma
  on public.borc_nisye_ledger (qaytarma_tarixi)
  where qaytarma_tarixi is not null;
