alter table public.plans
  add column if not exists description text,
  add column if not exists price_cents integer not null default 0,
  add column if not exists currency text not null default 'BRL',
  add column if not exists interval text not null default 'month',
  add column if not exists max_users integer,
  add column if not exists max_tables integer,
  add column if not exists highlighted boolean not null default false,
  add column if not exists sort_order integer not null default 0,
  add column if not exists features jsonb not null default '[]'::jsonb,
  add column if not exists mp_preapproval_plan_id text,
  add column if not exists active boolean not null default true;

alter table public.subscriptions
  add column if not exists billing_email text,
  add column if not exists mp_preapproval_id text,
  add column if not exists mp_plan_id text,
  add column if not exists mp_status text,
  add column if not exists provider text not null default 'mercadopago',
  add column if not exists trial_ends_at timestamptz,
  add column if not exists current_period_end timestamptz,
  add column if not exists canceled_at timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create unique index if not exists idx_subscriptions_org_unique on public.subscriptions(organization_id);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  type text not null default 'info',
  entity text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  document text not null,
  version text not null,
  accepted_at timestamptz not null default timezone('utc', now()),
  ip text
);

create table if not exists public.printer_stations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  sector_id uuid references public.kitchen_sectors(id),
  connection_type text not null default 'bluetooth',
  device_name text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_push_subs_org on public.push_subscriptions(organization_id);
create index if not exists idx_notifications_org on public.notifications(organization_id, created_at desc);

alter table public.push_subscriptions enable row level security;
alter table public.notifications enable row level security;
alter table public.legal_acceptances enable row level security;
alter table public.printer_stations enable row level security;

drop policy if exists push_select on public.push_subscriptions;
create policy push_select on public.push_subscriptions for select using (organization_id = public.current_org_id());
drop policy if exists push_write on public.push_subscriptions;
create policy push_write on public.push_subscriptions for all using (
  organization_id = public.current_org_id() and user_id = auth.uid()
) with check (organization_id = public.current_org_id() and user_id = auth.uid());

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select using (
  organization_id = public.current_org_id()
  and (user_id is null or user_id = auth.uid())
);
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update using (
  organization_id = public.current_org_id()
  and (user_id is null or user_id = auth.uid())
);
drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert with check (organization_id = public.current_org_id());

drop policy if exists legal_select on public.legal_acceptances;
create policy legal_select on public.legal_acceptances for select using (
  organization_id = public.current_org_id() and public.has_role(array['OWNER','ADMIN'])
);
drop policy if exists legal_insert on public.legal_acceptances;
create policy legal_insert on public.legal_acceptances for insert with check (true);

drop policy if exists printers_select on public.printer_stations;
create policy printers_select on public.printer_stations for select using (organization_id = public.current_org_id());
drop policy if exists printers_write on public.printer_stations;
create policy printers_write on public.printer_stations for all using (
  organization_id = public.current_org_id() and public.has_role(array['OWNER','ADMIN','MANAGER','KITCHEN'])
) with check (organization_id = public.current_org_id());

drop policy if exists subscriptions_write on public.subscriptions;
create policy subscriptions_write on public.subscriptions for update using (
  organization_id = public.current_org_id() and public.has_role(array['OWNER','ADMIN'])
);

grant select, insert, update, delete on public.push_subscriptions to authenticated, service_role;
grant select, insert, update on public.notifications to authenticated, service_role;
grant select, insert on public.legal_acceptances to authenticated, anon, service_role;
grant select, insert, update, delete on public.printer_stations to authenticated, service_role;
grant select on public.plans to anon, authenticated, service_role;
grant select, insert, update on public.subscriptions to authenticated, service_role;

do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.notifications';
  exception when duplicate_object then null;
  end;
end $$;

insert into public.plans (code, name, description, price_cents, max_users, max_tables, highlighted, sort_order, features, active)
values
  (
    'FREE',
    'Free',
    'Para testar o salão com um time pequeno.',
    0,
    3,
    8,
    false,
    1,
    '["Até 3 usuários","Até 8 mesas","KDS em tempo real","Caixa básico","Suporte por e-mail"]'::jsonb,
    true
  ),
  (
    'BASIC',
    'Basic',
    'Operação diária de bares e restaurantes pequenos.',
    9900,
    8,
    20,
    false,
    2,
    '["Até 8 usuários","Até 20 mesas","Garçom, cozinha e caixa","Impressão Bluetooth","Notificações push","14 dias de trial"]'::jsonb,
    true
  ),
  (
    'PRO',
    'Pro',
    'O plano completo para o salão crescer com controle.',
    19900,
    null,
    null,
    true,
    3,
    '["Usuários e mesas ilimitados","Relatórios e auditoria","Estoque e adicionais","Push + KDS + Bluetooth","Assinatura Mercado Pago","Prioridade no suporte"]'::jsonb,
    true
  ),
  (
    'ENTERPRISE',
    'Enterprise',
    'Redes, múltiplas unidades e operação sob medida.',
    0,
    null,
    null,
    false,
    4,
    '["Multi-unidades","SLA dedicado","Onboarding assistido","Integrações sob demanda","Contrato personalizado"]'::jsonb,
    true
  )
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  price_cents = excluded.price_cents,
  max_users = excluded.max_users,
  max_tables = excluded.max_tables,
  highlighted = excluded.highlighted,
  sort_order = excluded.sort_order,
  features = excluded.features,
  active = excluded.active;

update public.subscriptions s
set status = coalesce(nullif(s.status, ''), 'trialing'),
    trial_ends_at = coalesce(s.trial_ends_at, timezone('utc', now()) + interval '14 days'),
    current_period_end = coalesce(s.current_period_end, timezone('utc', now()) + interval '14 days')
where s.plan_id in (select id from public.plans where code = 'PRO');
