alter table public.organizations
  add column if not exists trial_started_at timestamptz not null default now(),
  add column if not exists trial_ends_at timestamptz not null default (now() + interval '15 days'),
  add column if not exists subscription_status text not null default 'trial' check (subscription_status in ('trial', 'active', 'expired', 'suspended'));

create table public.workspace_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  key_fingerprint text not null unique,
  plan text not null default 'standard',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  status text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index workspace_subscriptions_org_idx on public.workspace_subscriptions(org_id, status);
alter table public.workspace_subscriptions enable row level security;
create policy subscriptions_read_same_tenant on public.workspace_subscriptions
  for select using (org_id = public.current_org_id());
grant select on public.workspace_subscriptions to authenticated;

create or replace function public.workspace_access_state(p_org_id uuid default public.current_org_id())
returns table (has_access boolean, access_state text, trial_ends_at timestamptz, subscription_ends_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when o.subscription_status = 'active' then true
      when o.subscription_status = 'trial' and o.trial_ends_at > now() then true
      else false
    end as has_access,
    case
      when o.subscription_status = 'active' and (s.ends_at is null or s.ends_at > now()) then 'active'
      when o.subscription_status = 'trial' and o.trial_ends_at > now() then 'trial'
      when o.subscription_status = 'suspended' then 'suspended'
      else 'expired'
    end as access_state,
    o.trial_ends_at,
    s.ends_at
  from public.organizations o
  left join lateral (
    select ends_at from public.workspace_subscriptions
    where org_id = o.id and status = 'active'
    order by created_at desc limit 1
  ) s on true
  where o.id = p_org_id and o.id = public.current_org_id();
$$;

grant execute on function public.workspace_access_state(uuid) to authenticated;

create or replace function public.prevent_trial_extension()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.trial_started_at <> old.trial_started_at or new.trial_ends_at <> old.trial_ends_at then
    if not public.has_role(array['owner']::public.user_role[]) then
      new.trial_started_at := old.trial_started_at;
      new.trial_ends_at := old.trial_ends_at;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_trial_immutable on public.organizations;
create trigger organizations_trial_immutable
before update on public.organizations
for each row execute procedure public.prevent_trial_extension();

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
    if not exists (select 1 from public.organizations where id = new_org_id) then raise exception 'Invitation references an unknown organization'; end if;
    insert into public.profiles(id, org_id, email, full_name, role)
    values (new.id, new_org_id, coalesce(new.email, ''), coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Workspace Member'), coalesce(nullif(new.raw_user_meta_data ->> 'role', '')::public.user_role, 'manager'));
    return new;
  end if;
  requested_industry := (new.raw_user_meta_data ->> 'industry_type')::public.industry_type;
  requested_level := nullif(new.raw_user_meta_data ->> 'school_level', '')::public.school_level;
  insert into public.organizations(name, industry_type, school_level)
  values (coalesce(nullif(trim(new.raw_user_meta_data ->> 'org_name'), ''), 'New Organization'), coalesce(requested_industry, 'supermarket'::public.industry_type), case when requested_industry = 'school'::public.industry_type then requested_level else null end)
  returning id into new_org_id;
  insert into public.profiles(id, org_id, email, full_name, role)
  values (new.id, new_org_id, coalesce(new.email, ''), coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Workspace Owner'), 'owner');
  if requested_industry = 'school'::public.industry_type then insert into public.school_settings(org_id) values (new_org_id); end if;
  return new;
end;
$$;
