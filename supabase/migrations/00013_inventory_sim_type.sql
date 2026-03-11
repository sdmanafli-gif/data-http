-- Add sim_type column to inventory (SIM vs eSIM vs both)

alter table public.inventory
  add column if not exists sim_type text check (sim_type in ('sim', 'esim', 'both'));

