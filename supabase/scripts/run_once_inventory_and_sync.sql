-- Run in Supabase SQL Editor (one-time).
-- 1) Set all inventory status to Satıldı (sold)
-- 2) Add unique members from inventory to suppliers (təchizatçılar)
-- 3) Add unique products from inventory to product_catalogue (məhsul bazası)

-- ========== 1. Status = Satıldı ==========
update public.inventory
set status = 'sold';

-- ========== 2. Sync inventory (member, member_no) → suppliers ==========
-- Inserts distinct member/member_no as new suppliers where name is not empty and not already present.
insert into public.suppliers (name, phone)
select d.member_name, d.member_phone
from (
  select distinct
    trim(inv.member) as member_name,
    nullif(trim(inv.member_no), '') as member_phone
  from public.inventory inv
  where trim(inv.member) is not null and trim(inv.member) != ''
) d
where not exists (
  select 1 from public.suppliers s
  where s.name = d.member_name
    and (s.phone is not distinct from d.member_phone)
);

-- ========== 3. Sync inventory (type, model, color, memory) → product_catalogue ==========
-- Inserts distinct products; skips if combination already exists.
insert into public.product_catalogue (type, model, color, memory)
select distinct
  trim(inv.type),
  trim(inv.model),
  trim(inv.color),
  trim(inv.memory)
from public.inventory inv
where trim(inv.type) is not null and trim(inv.type) != ''
  and trim(inv.model) is not null and trim(inv.model) != ''
  and trim(inv.color) is not null and trim(inv.color) != ''
  and trim(inv.memory) is not null and trim(inv.memory) != ''
on conflict (type, model, color, memory) do nothing;
