create extension if not exists "pgcrypto";

create type public.industry_type as enum (
  'supermarket', 'water_factory', 'electrical_shop', 'pharmacy',
  'susu_finance', 'school', 'clinic'
);

create type public.user_role as enum (
  'owner', 'admin', 'manager', 'cashier', 'pharmacist', 'doctor',
  'teacher', 'collector', 'driver'
);

create type public.school_level as enum (
  'primary', 'junior_high', 'senior_high', 'primary_to_junior_high'
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) >= 2),
  address text,
  industry_type public.industry_type not null,
  school_level public.school_level,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_level_only_for_schools check (
    industry_type = 'school' or school_level is null
  )
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  full_name text not null check (length(trim(full_name)) >= 2),
  role public.user_role not null default 'owner',
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_org_id_idx on public.profiles(org_id);
create index profiles_email_idx on public.profiles(lower(email));

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  actor_role public.user_role,
  module text not null check (length(trim(module)) > 0),
  action text not null check (length(trim(action)) > 0),
  target_resource text,
  details jsonb not null default '{}'::jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);

create index audit_logs_org_created_idx on public.audit_logs(org_id, created_at desc);

create table public.school_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  academic_year text not null default '2026/2027',
  currency text not null default 'GHS',
  grading_scale jsonb not null default '{"pass_mark": 50, "maximum": 100}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.water_production_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  batch_number text not null,
  product_name text not null,
  quantity integer not null check (quantity >= 0),
  produced_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(org_id, batch_number)
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  sku text not null,
  name text not null,
  category text not null,
  quantity numeric(12,2) not null default 0 check (quantity >= 0),
  reorder_level numeric(12,2) not null default 0 check (reorder_level >= 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id, sku)
);

create table public.clinic_patients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  patient_number text not null,
  full_name text not null,
  phone text,
  date_of_birth date,
  created_at timestamptz not null default now(),
  unique(org_id, patient_number)
);

create table public.school_learners (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  admission_number text not null,
  full_name text not null,
  level text not null,
  guardian_name text,
  guardian_phone text,
  created_at timestamptz not null default now(),
  unique(org_id, admission_number)
);

create table public.susu_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_number text not null,
  customer_name text not null,
  phone text,
  balance numeric(12,2) not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  unique(org_id, account_number)
);

create table public.sales_transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  receipt_number text not null,
  total numeric(12,2) not null check (total >= 0),
  payment_method text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(org_id, receipt_number)
);

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.profiles where id = auth.uid() and is_active = true;
$$;

create or replace function public.has_role(required_roles public.user_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and is_active = true
      and role = any(required_roles)
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  requested_industry public.industry_type;
  requested_level public.school_level;
begin
  if nullif(new.raw_user_meta_data ->> 'org_id', '') is not null then
    new_org_id := (new.raw_user_meta_data ->> 'org_id')::uuid;
    if not exists (select 1 from public.organizations where id = new_org_id) then
      raise exception 'Invitation references an unknown organization';
    end if;

    insert into public.profiles(id, org_id, email, full_name, role)
    values (
      new.id,
      new_org_id,
      coalesce(new.email, ''),
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Workspace Member'),
      coalesce(nullif(new.raw_user_meta_data ->> 'role', '')::public.user_role, 'manager')
    );
    return new;
  end if;

  requested_industry := (new.raw_user_meta_data ->> 'industry_type')::public.industry_type;
  requested_level := nullif(new.raw_user_meta_data ->> 'school_level', '')::public.school_level;

  insert into public.organizations(name, industry_type, school_level)
  values (
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'org_name'), ''), 'New Organization'),
    coalesce(requested_industry, 'supermarket'::public.industry_type),
    case when requested_industry = 'school'::public.industry_type then requested_level else null end
  )
  returning id into new_org_id;

  insert into public.profiles(id, org_id, email, full_name, role)
  values (
    new.id,
    new_org_id,
    coalesce(new.email, ''),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Workspace Owner'),
    'owner'
  );

  if requested_industry = 'school'::public.industry_type then
    insert into public.school_settings(org_id) values (new_org_id);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.log_audit_event(
  p_org_id uuid,
  p_module text,
  p_action text,
  p_target_resource text default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_org_id is distinct from public.current_org_id() then
    raise exception 'Tenant boundary violation';
  end if;

  insert into public.audit_logs(org_id, actor_id, actor_email, actor_role, module, action, target_resource, details)
  select p_org_id, p.id, p.email, p.role, p_module, p_action, p_target_resource, coalesce(p_details, '{}'::jsonb)
  from public.profiles p
  where p.id = auth.uid();
end;
$$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.audit_logs enable row level security;
alter table public.school_settings enable row level security;
alter table public.water_production_runs enable row level security;
alter table public.inventory_items enable row level security;
alter table public.clinic_patients enable row level security;
alter table public.school_learners enable row level security;
alter table public.susu_accounts enable row level security;
alter table public.sales_transactions enable row level security;

create policy organizations_read_same_tenant on public.organizations for select using (id = public.current_org_id());
create policy organizations_update_admin on public.organizations for update using (id = public.current_org_id() and public.has_role(array['owner', 'admin']::public.user_role[])) with check (id = public.current_org_id());

create policy profiles_read_same_tenant on public.profiles for select using (org_id = public.current_org_id());
create policy profiles_update_admin on public.profiles for update using (org_id = public.current_org_id() and public.has_role(array['owner', 'admin']::public.user_role[])) with check (org_id = public.current_org_id());

create policy audit_logs_read_admin on public.audit_logs for select using (org_id = public.current_org_id() and public.has_role(array['owner', 'admin', 'manager']::public.user_role[]));

create policy school_settings_read_same_tenant on public.school_settings for select using (org_id = public.current_org_id());
create policy school_settings_update_admin on public.school_settings for update using (org_id = public.current_org_id() and public.has_role(array['owner', 'admin']::public.user_role[])) with check (org_id = public.current_org_id());

create policy water_runs_tenant_access on public.water_production_runs for all using (org_id = public.current_org_id()) with check (org_id = public.current_org_id());
create policy inventory_tenant_access on public.inventory_items for all using (org_id = public.current_org_id()) with check (org_id = public.current_org_id());
create policy clinic_tenant_access on public.clinic_patients for all using (org_id = public.current_org_id()) with check (org_id = public.current_org_id());
create policy learners_tenant_access on public.school_learners for all using (org_id = public.current_org_id()) with check (org_id = public.current_org_id());
create policy susu_tenant_access on public.susu_accounts for all using (org_id = public.current_org_id()) with check (org_id = public.current_org_id());
create policy sales_tenant_access on public.sales_transactions for all using (org_id = public.current_org_id()) with check (org_id = public.current_org_id());

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.current_org_id() to authenticated;
grant execute on function public.has_role(public.user_role[]) to authenticated;
grant execute on function public.log_audit_event(uuid, text, text, text, jsonb) to authenticated;
