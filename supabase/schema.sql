-- Mahalleli — Supabase şeması
-- Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  tc_kimlik text not null,
  email text,
  password text,
  name text not null,
  role text not null,
  phone text,
  address text,
  neighborhood text,
  city text,
  district text,
  unit text,
  merchant_type text,
  inventory jsonb not null default '[]'::jsonb,
  is_approved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tc_kimlik, role)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  requester_tc text,
  beneficiary_name text,
  merchant_name text,
  merchant_type text,
  items jsonb not null default '[]'::jsonb,
  product_total numeric not null default 0,
  courier_fee numeric not null default 0,
  total_price numeric not null default 0,
  delivery_type text not null default 'pickup',
  status text not null default 'bekliyor',
  donor_name text,
  qr_code text,
  funded_at timestamptz,
  delivered_at timestamptz,
  courier_handoff_at timestamptz,
  proxy_created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.pool (
  id int primary key default 1,
  balance numeric not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.pool (id, balance)
values (1, 0)
on conflict (id) do nothing;

create unique index if not exists profiles_tc_role_idx on public.profiles (tc_kimlik, role);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_merchant_type_idx on public.orders (merchant_type);
create index if not exists orders_requester_tc_idx on public.orders (requester_tc);
create index if not exists profiles_role_idx on public.profiles (role);

alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.pool enable row level security;

drop policy if exists "profiles_anon_all" on public.profiles;
create policy "profiles_anon_all" on public.profiles for all using (true) with check (true);

drop policy if exists "orders_anon_all" on public.orders;
create policy "orders_anon_all" on public.orders for all using (true) with check (true);

drop policy if exists "pool_anon_all" on public.pool;
create policy "pool_anon_all" on public.pool for all using (true) with check (true);

do $$
begin
  begin
    alter publication supabase_realtime add table public.orders;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.profiles;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.pool;
  exception when duplicate_object then null;
  end;
end $$;
