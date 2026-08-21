create table public.retail_products (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  sku text not null,
  name text not null,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  stock_quantity numeric(12,2) not null default 0 check (stock_quantity >= 0),
  created_at timestamptz not null default now(),
  unique(org_id, sku)
);

create index retail_products_org_name_idx on public.retail_products(org_id, name);
alter table public.retail_products enable row level security;
create policy retail_products_tenant_access on public.retail_products for all using (org_id = public.current_org_id()) with check (org_id = public.current_org_id());
grant select, insert, update, delete on public.retail_products to authenticated;
