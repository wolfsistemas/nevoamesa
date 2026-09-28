alter table public.sales
  add column if not exists status text not null default 'ACTIVE',
  add column if not exists refunded_at timestamptz,
  add column if not exists refund_amount numeric(12,2) not null default 0,
  add column if not exists refund_reason text;

alter table public.payments
  add column if not exists refunded_at timestamptz;

alter table public.attendances
  add column if not exists refunded_total numeric(12,2) not null default 0;

create index if not exists idx_cash_movements_register_type
  on public.cash_movements(cash_register_id, type);

comment on column public.sales.status is 'ACTIVE | REFUNDED';
