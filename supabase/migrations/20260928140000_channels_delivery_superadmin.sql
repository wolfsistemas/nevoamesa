-- Kitchen: delivered state so ready tickets leave the board.
do $$ begin
  alter type public.kitchen_ticket_status add value if not exists 'DELIVERED';
exception when duplicate_object then null; end $$;

-- Order channels (dine-in, counter, delivery, whatsapp, preorder, online menu).
do $$ begin
  create type public.order_channel as enum ('SALAO','BALCAO','DELIVERY','WHATSAPP','ENCOMENDA','ONLINE');
exception when duplicate_object then null; end $$;

alter table public.tables
  add column if not exists kind text not null default 'DINING';

alter table public.attendances
  add column if not exists channel public.order_channel not null default 'SALAO',
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists delivery_address text,
  add column if not exists delivery_fee numeric(12,2) not null default 0,
  add column if not exists delivery_status text,
  add column if not exists courier_name text,
  add column if not exists scheduled_for timestamptz;

alter table public.attendances alter column table_id drop not null;

alter table public.orders
  add column if not exists channel public.order_channel not null default 'SALAO';

alter table public.orders alter column table_id drop not null;

create index if not exists idx_attendances_channel on public.attendances(organization_id, channel, status);
create index if not exists idx_attendances_delivery on public.attendances(organization_id, delivery_status);

-- Superadmin flag and helper.
alter table public.profiles add column if not exists is_superadmin boolean not null default false;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_superadmin from public.profiles p where p.id = auth.uid() limit 1), false);
$$;

revoke all on function public.is_superadmin() from public;
grant execute on function public.is_superadmin() to authenticated, anon, service_role;

create table if not exists public.platform_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.platform_audit_logs enable row level security;

drop policy if exists platform_audit_select on public.platform_audit_logs;
create policy platform_audit_select on public.platform_audit_logs for select using (public.is_superadmin());
drop policy if exists platform_audit_insert on public.platform_audit_logs;
create policy platform_audit_insert on public.platform_audit_logs for insert with check (public.is_superadmin());

grant select, insert on public.platform_audit_logs to authenticated, service_role;
create index if not exists idx_platform_audit_created on public.platform_audit_logs(created_at desc);

-- Read/update access for superadmin across every tenant.
drop policy if exists org_super_select on public.organizations;
create policy org_super_select on public.organizations for select using (public.is_superadmin());
drop policy if exists org_super_update on public.organizations;
create policy org_super_update on public.organizations for update using (public.is_superadmin());

drop policy if exists settings_super_select on public.organization_settings;
create policy settings_super_select on public.organization_settings for select using (public.is_superadmin());

drop policy if exists profiles_super_select on public.profiles;
create policy profiles_super_select on public.profiles for select using (public.is_superadmin());
drop policy if exists profiles_super_update on public.profiles;
create policy profiles_super_update on public.profiles for update using (public.is_superadmin());

drop policy if exists user_roles_super_select on public.user_roles;
create policy user_roles_super_select on public.user_roles for select using (public.is_superadmin());

drop policy if exists subscriptions_super_select on public.subscriptions;
create policy subscriptions_super_select on public.subscriptions for select using (public.is_superadmin());
drop policy if exists subscriptions_super_update on public.subscriptions;
create policy subscriptions_super_update on public.subscriptions for update using (public.is_superadmin());

drop policy if exists tables_super_select on public.tables;
create policy tables_super_select on public.tables for select using (public.is_superadmin());
drop policy if exists products_super_select on public.products;
create policy products_super_select on public.products for select using (public.is_superadmin());
drop policy if exists categories_super_select on public.categories;
create policy categories_super_select on public.categories for select using (public.is_superadmin());
drop policy if exists attendances_super_select on public.attendances;
create policy attendances_super_select on public.attendances for select using (public.is_superadmin());
drop policy if exists orders_super_select on public.orders;
create policy orders_super_select on public.orders for select using (public.is_superadmin());
drop policy if exists sales_super_select on public.sales;
create policy sales_super_select on public.sales for select using (public.is_superadmin());
drop policy if exists audit_super_select on public.audit_logs;
create policy audit_super_select on public.audit_logs for select using (public.is_superadmin());

-- Cashier can also launch orders now that it operates tables.
drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders for insert with check (
  organization_id = public.current_org_id()
  and public.has_role(array['OWNER','ADMIN','MANAGER','WAITER','CASHIER'])
);
drop policy if exists order_items_insert on public.order_items;
create policy order_items_insert on public.order_items for insert with check (
  organization_id = public.current_org_id()
  and public.has_role(array['OWNER','ADMIN','MANAGER','WAITER','CASHIER'])
);
drop policy if exists order_item_addons_insert on public.order_item_addons;
create policy order_item_addons_insert on public.order_item_addons for insert with check (
  organization_id = public.current_org_id()
  and public.has_role(array['OWNER','ADMIN','MANAGER','WAITER','CASHIER'])
);
drop policy if exists kitchen_insert on public.kitchen_tickets;
create policy kitchen_insert on public.kitchen_tickets for insert with check (
  organization_id = public.current_org_id()
  and public.has_role(array['OWNER','ADMIN','MANAGER','WAITER','KITCHEN','CASHIER'])
);

-- Public online menu: security definer so anon never reads tenant tables directly.
create or replace function public.public_menu(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'organization', jsonb_build_object(
      'id', o.id,
      'name', o.name,
      'slug', o.slug,
      'phone', o.phone,
      'address', o.address,
      'logo_url', o.logo_url
    ),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'sort_order', c.sort_order) order by c.sort_order)
      from public.categories c
      where c.organization_id = o.id and c.active
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'description', p.description,
        'price', p.price,
        'image_url', p.image_url,
        'category_id', p.category_id
      ) order by p.sort_order, p.name)
      from public.products p
      where p.organization_id = o.id and p.active
    ), '[]'::jsonb)
  )
  from public.organizations o
  where o.slug = p_slug and o.active
  limit 1;
$$;

revoke all on function public.public_menu(text) from public;
grant execute on function public.public_menu(text) to anon, authenticated, service_role;
