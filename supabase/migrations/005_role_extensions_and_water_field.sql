alter type public.user_role add value if not exists 'front_desk';
alter type public.user_role add value if not exists 'sales_person';

create table public.water_field_transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  transaction_type text not null check (transaction_type in ('cash_sale', 'delivery_reconciliation')),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  units_loaded integer not null default 0 check (units_loaded >= 0),
  units_sold integer not null default 0 check (units_sold >= 0),
  units_returned integer not null default 0 check (units_returned >= 0),
  units_damaged integer not null default 0 check (units_damaged >= 0),
  reference text not null,
  client_recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index water_field_transactions_org_created_idx on public.water_field_transactions(org_id, created_at desc);
alter table public.water_field_transactions enable row level security;
create policy water_field_transactions_tenant_access on public.water_field_transactions for all using (org_id = public.current_org_id()) with check (org_id = public.current_org_id() and actor_id = auth.uid());
grant select, insert on public.water_field_transactions to authenticated;
