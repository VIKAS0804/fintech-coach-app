create extension if not exists pgcrypto;

do $$
begin
  create type public.signal_level as enum ('low', 'medium', 'high');
exception
  when duplicate_object then null;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  monthly_income numeric(12, 2),
  monthly_needs_budget numeric(12, 2),
  safe_to_spend_target numeric(12, 2),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.plaid_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plaid_item_id text not null unique,
  institution_name text,
  status text not null default 'active',
  cursor text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plaid_item_id text references public.plaid_items (plaid_item_id) on delete set null,
  plaid_account_id text not null unique,
  name text not null,
  official_name text,
  subtype text,
  mask text,
  current_balance numeric(12, 2),
  available_balance numeric(12, 2),
  iso_currency_code text not null default 'USD',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  plaid_transaction_id text not null unique,
  name text not null,
  merchant_name text,
  amount numeric(12, 2) not null,
  authorized_date date,
  posted_date date not null,
  category jsonb not null default '[]'::jsonb,
  channel text,
  iso_currency_code text not null default 'USD',
  is_pending boolean not null default false,
  removed_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.coaching_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  transaction_id uuid references public.transactions (id) on delete cascade,
  level public.signal_level not null,
  tag text not null,
  score integer not null check (score between 0 and 100),
  reason text not null,
  suggestion text not null,
  detected_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (transaction_id)
);

create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists plaid_items_user_cursor_idx on public.plaid_items (user_id, cursor);
create index if not exists accounts_user_subtype_idx on public.accounts (user_id, subtype);
create index if not exists transactions_user_posted_date_idx on public.transactions (user_id, posted_date desc);
create index if not exists transactions_user_merchant_idx on public.transactions (user_id, merchant_name);
create index if not exists transactions_user_removed_idx on public.transactions (user_id, removed_at);
create index if not exists coaching_signals_user_detected_idx on public.coaching_signals (user_id, detected_at desc);
create index if not exists coaching_signals_user_score_idx on public.coaching_signals (user_id, score desc);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists plaid_items_set_updated_at on public.plaid_items;
create trigger plaid_items_set_updated_at
before update on public.plaid_items
for each row execute procedure public.set_updated_at();

drop trigger if exists accounts_set_updated_at on public.accounts;
create trigger accounts_set_updated_at
before update on public.accounts
for each row execute procedure public.set_updated_at();

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
before update on public.transactions
for each row execute procedure public.set_updated_at();

drop trigger if exists coaching_signals_set_updated_at on public.coaching_signals;
create trigger coaching_signals_set_updated_at
before update on public.coaching_signals
for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.plaid_items enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.coaching_signals enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "plaid_items_manage_own" on public.plaid_items;
create policy "plaid_items_manage_own"
on public.plaid_items
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "accounts_manage_own" on public.accounts;
create policy "accounts_manage_own"
on public.accounts
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "transactions_manage_own" on public.transactions;
create policy "transactions_manage_own"
on public.transactions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "coaching_signals_manage_own" on public.coaching_signals;
create policy "coaching_signals_manage_own"
on public.coaching_signals
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
