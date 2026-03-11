-- Add comments column to suppliers (təchizatçılar üçün şərh sahəsi)

alter table public.suppliers
  add column if not exists comments text;

