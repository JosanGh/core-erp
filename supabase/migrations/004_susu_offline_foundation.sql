create table public.susu_ledger (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.susu_accounts(id) on delete cascade,
  collector_id uuid not null references auth.users(id),
  transaction_type text not null check (transaction_type in ('deposit', 'loan_repayment', 'withdrawal')),
  amount numeric(12,2) not null check (amount > 0),
  balance_after numeric(12,2) not null default 0 check (balance_after >= 0),
  client_recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  notes text
);

create table public.susu_loans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.susu_accounts(id) on delete cascade,
  loan_number text not null,
  principal_amount numeric(12,2) not null check (principal_amount > 0),
  total_repayment_amount numeric(12,2) not null check (total_repayment_amount >= principal_amount),
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  due_date date not null,
  status text not null default 'active' check (status in ('active', 'fully_paid', 'defaulted')),
  created_at timestamptz not null default now(),
  unique(org_id, loan_number)
);

create index susu_ledger_org_created_idx on public.susu_ledger(org_id, created_at desc);
create index susu_loans_org_status_idx on public.susu_loans(org_id, status);
alter table public.susu_ledger enable row level security;
alter table public.susu_loans enable row level security;
create policy susu_ledger_tenant_access on public.susu_ledger for all using (org_id = public.current_org_id()) with check (org_id = public.current_org_id());
create policy susu_loans_tenant_access on public.susu_loans for all using (org_id = public.current_org_id()) with check (org_id = public.current_org_id());
grant select, insert, update, delete on public.susu_ledger, public.susu_loans to authenticated;

create or replace function public.record_susu_transaction(
  p_id uuid,
  p_org_id uuid,
  p_account_id uuid,
  p_collector_id uuid,
  p_transaction_type text,
  p_amount numeric,
  p_loan_id uuid default null,
  p_client_recorded_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  next_balance numeric;
begin
  if p_org_id is distinct from public.current_org_id() or p_collector_id is distinct from auth.uid() then
    raise exception 'Tenant or collector boundary violation';
  end if;

  update public.susu_accounts
  set balance = balance + p_amount
  where id = p_account_id and org_id = p_org_id
  returning balance into next_balance;

  if next_balance is null then raise exception 'Susu account not found'; end if;

  insert into public.susu_ledger(id, org_id, account_id, collector_id, transaction_type, amount, balance_after, client_recorded_at, notes)
  values (p_id, p_org_id, p_account_id, p_collector_id, p_transaction_type, p_amount, next_balance, p_client_recorded_at, 'Field collection');

  if p_transaction_type = 'loan_repayment' and p_loan_id is not null then
    update public.susu_loans
    set amount_paid = amount_paid + p_amount,
        status = case when amount_paid + p_amount >= total_repayment_amount then 'fully_paid' else 'active' end
    where id = p_loan_id and account_id = p_account_id and org_id = p_org_id;
  end if;
end;
$$;

grant execute on function public.record_susu_transaction(uuid, uuid, uuid, uuid, text, numeric, uuid, timestamptz) to authenticated;
