create table public.workspace_subscription_plans (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  monthly_fee numeric(12,2) not null default 50 check (monthly_fee >= 0),
  currency text not null default 'GHS',
  plan_name text not null default 'standard',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table public.workspace_notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete cascade,
  notification_type text not null check (notification_type in ('trial_started', 'trial_reminder', 'trial_expired', 'subscription_updated')),
  scheduled_for timestamptz not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(org_id, recipient_id, notification_type, scheduled_for)
);

create index workspace_notifications_recipient_idx on public.workspace_notifications(recipient_id, scheduled_for desc);
alter table public.workspace_subscription_plans enable row level security;
alter table public.workspace_notifications enable row level security;
create policy subscription_plans_owner_read on public.workspace_subscription_plans for select using (org_id = public.current_org_id());
create policy notifications_recipient_read on public.workspace_notifications for select using (org_id = public.current_org_id() and (recipient_id is null or recipient_id = auth.uid()));
create policy notifications_recipient_update on public.workspace_notifications for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
grant select on public.workspace_subscription_plans, public.workspace_notifications to authenticated;
grant update on public.workspace_notifications to authenticated;

create or replace function public.set_workspace_subscription_plan(p_org_id uuid, p_monthly_fee numeric, p_plan_name text default 'standard')
returns public.workspace_subscription_plans
language plpgsql security definer set search_path = public
as $$
declare result public.workspace_subscription_plans;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and org_id = p_org_id and role in ('owner','admin') and is_active) then raise exception 'Workspace administrator required'; end if;
  insert into public.workspace_subscription_plans(org_id, monthly_fee, plan_name, updated_by)
  values (p_org_id, p_monthly_fee, p_plan_name, auth.uid())
  on conflict (org_id) do update set monthly_fee = excluded.monthly_fee, plan_name = excluded.plan_name, updated_by = auth.uid(), updated_at = now()
  returning * into result;
  return result;
end;
$$;

grant execute on function public.set_workspace_subscription_plan(uuid, numeric, text) to authenticated;

create or replace function public.cancel_workspace_subscription(p_org_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and org_id = p_org_id and role in ('owner','admin') and is_active) then raise exception 'Workspace administrator required'; end if;
  update public.workspace_subscriptions set status = 'revoked' where org_id = p_org_id and status = 'active';
  update public.organizations set subscription_status = 'suspended' where id = p_org_id;
end;
$$;

grant execute on function public.cancel_workspace_subscription(uuid) to authenticated;
