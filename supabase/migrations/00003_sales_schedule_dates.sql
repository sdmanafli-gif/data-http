-- Mobideal: Kredit/Nisə cədvəli üçün tarix sahələri
-- İlkin ödəniş tarixi (Verilmə Tarixi) və Kredit başlanğıc tarixi (aylıq ödənişlər üçün)

alter table public.sales
  add column if not exists terms_ilkin_date date,
  add column if not exists terms_payment_start_date date;

comment on column public.sales.terms_ilkin_date is 'Verilmə Tarixi — ilkin ödənişin son tarixi';
comment on column public.sales.terms_payment_start_date is 'Kredit başlanğıc tarixi — aylıq ödənişlərin başlanğıcı';
