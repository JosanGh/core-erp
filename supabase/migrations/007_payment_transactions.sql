create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('paystack', 'hubtel')),
  reference text not null,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'GHS',
  plan text not null default 'standard',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  provider_payload jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique(provider, reference)
);

alter table public.workspace_subscriptions
  add column if not exists provider text,
  add column if not exists provider_reference text;

alter table public.workspace_subscriptions
  drop constraint if exists workspace_subscriptions_key_fingerprint_key;

create unique index if not exists workspace_subscriptions_provider_ref_idx on public.workspace_subscriptions(provider, provider_reference) where provider_reference is not null;
create index payment_transactions_org_idx on public.payment_transactions(org_id, created_at desc);
alter table public.payment_transactions enable row level security;
create policy payment_transactions_read_same_tenant on public.payment_transactions for select using (org_id = public.current_org_id());
grant select on public.payment_transactions to authenticated;
