-- Credit sales: add relevant columns from credit-sales spec (client number, amounts, dates, seller, contract, ilkin)
-- Inventory: add attachments column for file paths (files stored in Supabase Storage bucket "Mobideal")
-- Clients: add fields used in credit flow (fin, birth_date, id doc, addresses, extra phones)

-- 1. Sales — credit-relevant columns
alter table public.sales add column if not exists client_number text;
alter table public.sales add column if not exists purchase_price numeric(12, 2);
alter table public.sales add column if not exists total_paid numeric(12, 2) default 0;
alter table public.sales add column if not exists remaining_debt numeric(12, 2);
alter table public.sales add column if not exists expected_income numeric(12, 2);
alter table public.sales add column if not exists actual_income numeric(12, 2);
alter table public.sales add column if not exists delivery_date date;
alter table public.sales add column if not exists end_date date;
alter table public.sales add column if not exists payment_day int check (payment_day is null or (payment_day >= 1 and payment_day <= 31));
alter table public.sales add column if not exists seller_name text;
alter table public.sales add column if not exists seller_commission numeric(12, 2);
alter table public.sales add column if not exists down_payment numeric(12, 2);
alter table public.sales add column if not exists contract_number text;
alter table public.sales add column if not exists initial_payment_completed boolean default false;
alter table public.sales add column if not exists initial_payment_remaining numeric(12, 2);
alter table public.sales add column if not exists days_to_complete_initial_payment int;
alter table public.sales add column if not exists credit_documents text;

comment on column public.sales.client_number is 'Müştəri nömrəsi (credit sale ref)';
comment on column public.sales.purchase_price is 'Alış qiyməti';
comment on column public.sales.total_paid is 'Toplam ödenish';
comment on column public.sales.remaining_debt is 'Qaliq borc';
comment on column public.sales.expected_income is 'Gözlenilen gelir';
comment on column public.sales.actual_income is 'Real gelir';
comment on column public.sales.delivery_date is 'Verilmə tarixi';
comment on column public.sales.end_date is 'Bitmə tarixi';
comment on column public.sales.payment_day is 'Ödenish günü (1-31)';
comment on column public.sales.seller_name is 'Satici';
comment on column public.sales.seller_commission is 'Satici gelir meblegi';
comment on column public.sales.down_payment is 'Ilkin ödenish';
comment on column public.sales.contract_number is 'Müqavile nömresi';
comment on column public.sales.initial_payment_completed is 'Ilkin ödenish tamamlanib';
comment on column public.sales.initial_payment_remaining is 'Ilkin ödenish qaliq';
comment on column public.sales.days_to_complete_initial_payment is 'Ilkin ödenish tamamlamaya qaliq gün';
comment on column public.sales.credit_documents is 'Senedler (qeyd)';

-- 2. Inventory — file attachments (paths in Storage bucket Mobideal)
alter table public.inventory add column if not exists attachments text;
comment on column public.inventory.attachments is 'JSON array of {name, path} for files in Storage bucket Mobideal';

-- 3. Clients — fields for credit form (Fin, Doğum, Şəxsiyyət, ünvan, əlavə telefonlar)
alter table public.clients add column if not exists fin_number text;
alter table public.clients add column if not exists birth_date date;
alter table public.clients add column if not exists id_serial text;
alter table public.clients add column if not exists id_issue_date date;
alter table public.clients add column if not exists id_issued_by text;
alter table public.clients add column if not exists registration_address text;
alter table public.clients add column if not exists residential_address text;
alter table public.clients add column if not exists phone_2 text;
alter table public.clients add column if not exists phone_3 text;
alter table public.clients add column if not exists phone_4 text;

comment on column public.clients.fin_number is 'Fin nömre';
comment on column public.clients.birth_date is 'Dogum tarixi';
comment on column public.clients.id_serial is 'Sexsiyyet seria';
comment on column public.clients.id_issue_date is 'Sexsiyyet tarix';
comment on column public.clients.id_issued_by is 'Sexsiyyet verilme qurum';
comment on column public.clients.registration_address is 'Qeydiyyat ünvani';
comment on column public.clients.residential_address is 'Yashayish ünvani';
comment on column public.clients.phone_2 is 'Mobil # 2';
comment on column public.clients.phone_3 is 'Mobil # 3';
comment on column public.clients.phone_4 is 'Mobil # 4';
