create table public.pharmacy_batches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  medicine_name text not null,
  active_ingredient text,
  batch_number text not null,
  quantity_remaining integer not null default 0 check (quantity_remaining >= 0),
  expiry_date date not null,
  prescription_required boolean not null default false,
  created_at timestamptz not null default now(),
  unique(org_id, batch_number)
);

create index pharmacy_batches_org_expiry_idx on public.pharmacy_batches(org_id, expiry_date);
alter table public.pharmacy_batches enable row level security;
create policy pharmacy_batches_tenant_access on public.pharmacy_batches for all using (org_id = public.current_org_id()) with check (org_id = public.current_org_id());
grant select, insert, update, delete on public.pharmacy_batches to authenticated;
