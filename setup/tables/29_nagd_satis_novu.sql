-- ============================================================
-- Nağd satış: tag cash vs nisyə product sales
-- ============================================================

alter table public.nagd_satish
  add column if not exists satis_novu text not null default 'nagd';

alter table public.nagd_satish
  drop constraint if exists nagd_satish_satis_novu_check;

alter table public.nagd_satish
  add constraint nagd_satish_satis_novu_check
  check (satis_novu in ('nagd', 'nisye'));

create index if not exists idx_nagd_satish_satis_novu
  on public.nagd_satish (satis_novu);

comment on column public.nagd_satish.satis_novu is
  'nagd = cash sale; nisye = nisyə verdim product sale (also in borc_nisye_ledger)';
