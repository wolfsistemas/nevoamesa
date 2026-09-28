create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

do $$ begin
  create type public.user_role as enum ('OWNER','ADMIN','MANAGER','CASHIER','WAITER','KITCHEN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.table_status as enum ('FREE','OCCUPIED','WAITING_PAYMENT','RESERVED','UNAVAILABLE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attendance_status as enum ('OPEN','WAITING_PAYMENT','CLOSED','CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum ('PENDING','SENT','PREPARING','READY','DELIVERED','CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.kitchen_ticket_status as enum ('NEW','PREPARING','READY','CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.cash_register_status as enum ('OPEN','CLOSED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('CASH','PIX','DEBIT','CREDIT','OTHER');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.cash_movement_type as enum ('OPENING','SALE','WITHDRAWAL','SUPPLY','REFUND','ADJUSTMENT','CLOSING');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.inventory_movement_type as enum ('IN','OUT','ADJUSTMENT','SALE','CANCELLATION');
exception when duplicate_object then null; end $$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  phone text,
  address text,
  document text,
  logo_url text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.organization_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  currency text not null default 'BRL',
  service_fee_percent numeric(10,2) not null default 10,
  allow_discount boolean not null default true,
  allow_negative_stock boolean not null default false,
  print_enabled boolean not null default true,
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  primary_role public.user_role not null default 'WAITER',
  active boolean not null default true,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code public.user_role not null unique,
  name text not null
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role public.user_role not null,
  unique (user_id, role)
);

create or replace function public.current_profile()
returns table (
  id uuid,
  organization_id uuid,
  primary_role text,
  active boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.organization_id, p.primary_role::text, p.active
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.current_profile() limit 1;
$$;

create or replace function public.has_role(roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.current_profile() p
    where p.active
      and (
        p.primary_role = any(roles)
        or exists (
          select 1 from public.user_roles ur
          where ur.user_id = p.id
            and ur.role::text = any(roles)
        )
      )
  );
$$;

revoke all on function public.current_profile() from public;
revoke all on function public.current_org_id() from public;
revoke all on function public.has_role(text[]) from public;
grant execute on function public.current_profile() to authenticated, anon, service_role;
grant execute on function public.current_org_id() to authenticated, anon, service_role;
grant execute on function public.has_role(text[]) to authenticated, anon, service_role;

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid references public.plans(id),
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.subscription_limits (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  key text not null,
  value integer not null default 0
);

create table if not exists public.usage_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  value numeric not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.kitchen_sectors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  color text not null default '#F59E0B',
  sort_order integer not null default 0,
  active boolean not null default true
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category_id uuid references public.categories(id),
  kitchen_sector_id uuid references public.kitchen_sectors(id),
  name text not null,
  description text,
  price numeric(12,2) not null default 0,
  cost numeric(12,2) not null default 0,
  image_url text,
  active boolean not null default true,
  control_stock boolean not null default false,
  stock_qty numeric(12,3) not null default 0,
  unit text not null default 'un',
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.addon_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  required boolean not null default false,
  min_select integer not null default 0,
  max_select integer not null default 1,
  active boolean not null default true
);

create table if not exists public.addon_group_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.addon_groups(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  price numeric(12,2) not null default 0,
  active boolean not null default true
);

create table if not exists public.product_addons (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  price numeric(12,2) not null default 0,
  active boolean not null default true
);

create table if not exists public.tables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  number integer not null,
  name text,
  capacity integer not null default 4,
  sector text,
  status public.table_status not null default 'FREE',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, number)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  document text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.attendances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  table_id uuid not null references public.tables(id),
  waiter_id uuid references public.profiles(id),
  customer_id uuid references public.customers(id),
  status public.attendance_status not null default 'OPEN',
  opened_at timestamptz not null default timezone('utc', now()),
  closed_at timestamptz,
  subtotal numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  discount_percent numeric(12,2) not null default 0,
  service_fee numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  attendance_id uuid not null references public.attendances(id) on delete cascade,
  table_id uuid not null references public.tables(id),
  waiter_id uuid references public.profiles(id),
  number integer not null,
  status public.order_status not null default 'SENT',
  notes text,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  name text not null,
  quantity integer not null default 1,
  unit_price numeric(12,2) not null,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.order_item_addons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  name text not null,
  price numeric(12,2) not null default 0
);

create table if not exists public.kitchen_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  sector_id uuid references public.kitchen_sectors(id),
  status public.kitchen_ticket_status not null default 'NEW',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  accepted_at timestamptz,
  ready_at timestamptz
);

create table if not exists public.cash_registers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  opened_by uuid not null references public.profiles(id),
  closed_by uuid references public.profiles(id),
  status public.cash_register_status not null default 'OPEN',
  opening_amount numeric(12,2) not null default 0,
  closing_amount numeric(12,2),
  expected_amount numeric(12,2),
  difference_amount numeric(12,2),
  notes text,
  opened_at timestamptz not null default timezone('utc', now()),
  closed_at timestamptz
);

create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cash_register_id uuid not null references public.cash_registers(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  type public.cash_movement_type not null,
  payment_method public.payment_method,
  amount numeric(12,2) not null,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  attendance_id uuid not null references public.attendances(id),
  cash_register_id uuid references public.cash_registers(id),
  cashier_id uuid not null references public.profiles(id),
  waiter_id uuid references public.profiles(id),
  subtotal numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  service_fee numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  unique (attendance_id)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  attendance_id uuid references public.attendances(id),
  sale_id uuid references public.sales(id),
  method public.payment_method not null,
  amount numeric(12,2) not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  method public.payment_method not null,
  amount numeric(12,2) not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id),
  user_id uuid references public.profiles(id),
  type public.inventory_movement_type not null,
  quantity numeric(12,3) not null,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_profiles_org on public.profiles(organization_id);
create index if not exists idx_products_org on public.products(organization_id, active);
create index if not exists idx_tables_org_status on public.tables(organization_id, status);
create index if not exists idx_attendances_org_status on public.attendances(organization_id, status);
create index if not exists idx_orders_org_status on public.orders(organization_id, status);
create index if not exists idx_kitchen_tickets_org_status on public.kitchen_tickets(organization_id, status);
create index if not exists idx_sales_org_created on public.sales(organization_id, created_at desc);
create index if not exists idx_cash_registers_org_status on public.cash_registers(organization_id, status);

drop trigger if exists trg_org_updated on public.organizations;
create trigger trg_org_updated before update on public.organizations for each row execute function public.set_updated_at();
drop trigger if exists trg_settings_updated on public.organization_settings;
create trigger trg_settings_updated before update on public.organization_settings for each row execute function public.set_updated_at();
drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists trg_products_updated on public.products;
create trigger trg_products_updated before update on public.products for each row execute function public.set_updated_at();
drop trigger if exists trg_tables_updated on public.tables;
create trigger trg_tables_updated before update on public.tables for each row execute function public.set_updated_at();
drop trigger if exists trg_attendances_updated on public.attendances;
create trigger trg_attendances_updated before update on public.attendances for each row execute function public.set_updated_at();
drop trigger if exists trg_orders_updated on public.orders;
create trigger trg_orders_updated before update on public.orders for each row execute function public.set_updated_at();
drop trigger if exists trg_tickets_updated on public.kitchen_tickets;
create trigger trg_tickets_updated before update on public.kitchen_tickets for each row execute function public.set_updated_at();

create or replace function public.write_audit(
  p_org uuid,
  p_user uuid,
  p_action text,
  p_entity text,
  p_entity_id uuid,
  p_metadata jsonb default '{}'::jsonb
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_logs(organization_id, user_id, action, entity, entity_id, metadata)
  values (p_org, p_user, p_action, p_entity, p_entity_id, p_metadata);
$$;

create or replace function public.next_order_number(p_org uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select coalesce(max(number), 1000) + 1 from public.orders where organization_id = p_org;
$$;

alter table public.organizations enable row level security;
alter table public.organization_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.user_roles enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_limits enable row level security;
alter table public.usage_metrics enable row level security;
alter table public.categories enable row level security;
alter table public.kitchen_sectors enable row level security;
alter table public.products enable row level security;
alter table public.addon_groups enable row level security;
alter table public.addon_group_items enable row level security;
alter table public.product_addons enable row level security;
alter table public.tables enable row level security;
alter table public.customers enable row level security;
alter table public.attendances enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_addons enable row level security;
alter table public.kitchen_tickets enable row level security;
alter table public.cash_registers enable row level security;
alter table public.cash_movements enable row level security;
alter table public.sales enable row level security;
alter table public.payments enable row level security;
alter table public.sale_payments enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.audit_logs enable row level security;

create policy org_select on public.organizations for select using (id = public.current_org_id());
create policy org_update on public.organizations for update using (id = public.current_org_id() and public.has_role(array['OWNER','ADMIN']));

create policy settings_select on public.organization_settings for select using (organization_id = public.current_org_id());
create policy settings_update on public.organization_settings for update using (organization_id = public.current_org_id() and public.has_role(array['OWNER','ADMIN','MANAGER']));

create policy profiles_select on public.profiles for select using (organization_id = public.current_org_id());
create policy profiles_update on public.profiles for update using (
  organization_id = public.current_org_id()
  and (id = auth.uid() or public.has_role(array['OWNER','ADMIN']))
);

create policy roles_select on public.roles for select using (true);
create policy user_roles_select on public.user_roles for select using (organization_id = public.current_org_id());
create policy user_roles_write on public.user_roles for all using (organization_id = public.current_org_id() and public.has_role(array['OWNER','ADMIN']));

create policy plans_select on public.plans for select using (true);
create policy subscriptions_select on public.subscriptions for select using (organization_id = public.current_org_id());
create policy usage_select on public.usage_metrics for select using (organization_id = public.current_org_id());

create policy categories_select on public.categories for select using (organization_id = public.current_org_id());
create policy categories_write on public.categories for all using (organization_id = public.current_org_id() and public.has_role(array['OWNER','ADMIN','MANAGER'])) with check (organization_id = public.current_org_id());

create policy sectors_select on public.kitchen_sectors for select using (organization_id = public.current_org_id());
create policy sectors_write on public.kitchen_sectors for all using (organization_id = public.current_org_id() and public.has_role(array['OWNER','ADMIN','MANAGER'])) with check (organization_id = public.current_org_id());

create policy products_select on public.products for select using (organization_id = public.current_org_id());
create policy products_write on public.products for all using (organization_id = public.current_org_id() and public.has_role(array['OWNER','ADMIN','MANAGER'])) with check (organization_id = public.current_org_id());

create policy addon_groups_select on public.addon_groups for select using (organization_id = public.current_org_id());
create policy addon_groups_write on public.addon_groups for all using (organization_id = public.current_org_id() and public.has_role(array['OWNER','ADMIN','MANAGER'])) with check (organization_id = public.current_org_id());
create policy addon_items_select on public.addon_group_items for select using (organization_id = public.current_org_id());
create policy addon_items_write on public.addon_group_items for all using (organization_id = public.current_org_id() and public.has_role(array['OWNER','ADMIN','MANAGER'])) with check (organization_id = public.current_org_id());
create policy product_addons_select on public.product_addons for select using (organization_id = public.current_org_id());
create policy product_addons_write on public.product_addons for all using (organization_id = public.current_org_id() and public.has_role(array['OWNER','ADMIN','MANAGER'])) with check (organization_id = public.current_org_id());

create policy tables_select on public.tables for select using (organization_id = public.current_org_id());
create policy tables_update_ops on public.tables for update using (
  organization_id = public.current_org_id()
  and public.has_role(array['OWNER','ADMIN','MANAGER','WAITER','CASHIER'])
);
create policy tables_admin on public.tables for insert with check (organization_id = public.current_org_id() and public.has_role(array['OWNER','ADMIN','MANAGER']));

create policy customers_select on public.customers for select using (organization_id = public.current_org_id());
create policy customers_write on public.customers for all using (organization_id = public.current_org_id() and public.has_role(array['OWNER','ADMIN','MANAGER','CASHIER','WAITER'])) with check (organization_id = public.current_org_id());

create policy attendances_select on public.attendances for select using (organization_id = public.current_org_id());
create policy attendances_insert on public.attendances for insert with check (organization_id = public.current_org_id() and public.has_role(array['OWNER','ADMIN','MANAGER','WAITER','CASHIER']));
create policy attendances_update on public.attendances for update using (organization_id = public.current_org_id() and public.has_role(array['OWNER','ADMIN','MANAGER','WAITER','CASHIER']));

create policy orders_select on public.orders for select using (organization_id = public.current_org_id());
create policy orders_insert on public.orders for insert with check (organization_id = public.current_org_id() and public.has_role(array['OWNER','ADMIN','MANAGER','WAITER']));
create policy orders_update on public.orders for update using (organization_id = public.current_org_id() and public.has_role(array['OWNER','ADMIN','MANAGER','WAITER','KITCHEN','CASHIER']));

create policy order_items_select on public.order_items for select using (organization_id = public.current_org_id());
create policy order_items_insert on public.order_items for insert with check (organization_id = public.current_org_id() and public.has_role(array['OWNER','ADMIN','MANAGER','WAITER']));
create policy order_item_addons_select on public.order_item_addons for select using (organization_id = public.current_org_id());
create policy order_item_addons_insert on public.order_item_addons for insert with check (organization_id = public.current_org_id() and public.has_role(array['OWNER','ADMIN','MANAGER','WAITER']));

create policy kitchen_select on public.kitchen_tickets for select using (organization_id = public.current_org_id());
create policy kitchen_insert on public.kitchen_tickets for insert with check (organization_id = public.current_org_id() and public.has_role(array['OWNER','ADMIN','MANAGER','WAITER','KITCHEN']));
create policy kitchen_update on public.kitchen_tickets for update using (organization_id = public.current_org_id() and public.has_role(array['OWNER','ADMIN','MANAGER','KITCHEN']));

create policy cash_select on public.cash_registers for select using (
  organization_id = public.current_org_id()
  and public.has_role(array['OWNER','ADMIN','MANAGER','CASHIER'])
);
create policy cash_write on public.cash_registers for all using (
  organization_id = public.current_org_id()
  and public.has_role(array['OWNER','ADMIN','MANAGER','CASHIER'])
) with check (organization_id = public.current_org_id());

create policy cash_mov_select on public.cash_movements for select using (
  organization_id = public.current_org_id()
  and public.has_role(array['OWNER','ADMIN','MANAGER','CASHIER'])
);
create policy cash_mov_insert on public.cash_movements for insert with check (
  organization_id = public.current_org_id()
  and public.has_role(array['OWNER','ADMIN','MANAGER','CASHIER'])
);

create policy sales_select on public.sales for select using (
  organization_id = public.current_org_id()
  and public.has_role(array['OWNER','ADMIN','MANAGER','CASHIER'])
);
create policy sales_insert on public.sales for insert with check (
  organization_id = public.current_org_id()
  and public.has_role(array['OWNER','ADMIN','MANAGER','CASHIER'])
);
create policy payments_select on public.payments for select using (organization_id = public.current_org_id() and public.has_role(array['OWNER','ADMIN','MANAGER','CASHIER']));
create policy payments_insert on public.payments for insert with check (organization_id = public.current_org_id() and public.has_role(array['OWNER','ADMIN','MANAGER','CASHIER']));
create policy sale_payments_select on public.sale_payments for select using (organization_id = public.current_org_id() and public.has_role(array['OWNER','ADMIN','MANAGER','CASHIER']));
create policy sale_payments_insert on public.sale_payments for insert with check (organization_id = public.current_org_id() and public.has_role(array['OWNER','ADMIN','MANAGER','CASHIER']));

create policy inventory_select on public.inventory_movements for select using (organization_id = public.current_org_id() and public.has_role(array['OWNER','ADMIN','MANAGER']));
create policy inventory_insert on public.inventory_movements for insert with check (organization_id = public.current_org_id() and public.has_role(array['OWNER','ADMIN','MANAGER']));

create policy audit_select on public.audit_logs for select using (organization_id = public.current_org_id() and public.has_role(array['OWNER','ADMIN','MANAGER']));
create policy audit_insert on public.audit_logs for insert with check (organization_id = public.current_org_id());

do $$
declare
  t text;
begin
  foreach t in array array[
    'orders',
    'order_items',
    'kitchen_tickets',
    'tables',
    'attendances',
    'sales',
    'cash_registers',
    'payments'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then
      null;
    end;
  end loop;
end $$;
