-- Allow comment-only ledger tip (no money movement)
alter table public.borc_nisye_ledger
  drop constraint if exists borc_nisye_ledger_tip_check;

alter table public.borc_nisye_ledger
  add constraint borc_nisye_ledger_tip_check
  check (tip in ('borc_verdim', 'borc_aldim', 'nisye_verdim', 'nisye_odenis', 'qeyd'));
