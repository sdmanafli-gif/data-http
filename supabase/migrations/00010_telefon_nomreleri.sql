-- Telefon nömrələri — nömrə, ad, yeniləmə tarixi (gün fərqi ilə sıralama və 90+ gün qırmızı)

create table if not exists public.telefon_nomreleri (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  name text,
  update_date date not null default current_date,
  created_at timestamptz not null default now()
);

comment on table public.telefon_nomreleri is 'Telefon nömrələri — nömrə, ad, son yeniləmə tarixi';
comment on column public.telefon_nomreleri.update_date is 'Son yeniləmə tarixi (gün fərqi hesablanır)';

create index if not exists idx_telefon_nomreleri_update_date on public.telefon_nomreleri(update_date);

alter table public.telefon_nomreleri enable row level security;
create policy "Allow all for anon" on public.telefon_nomreleri for all using (true) with check (true);
