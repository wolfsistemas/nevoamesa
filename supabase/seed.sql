insert into public.roles (code, name) values
  ('OWNER', 'Proprietário'),
  ('ADMIN', 'Administrador'),
  ('MANAGER', 'Gerente'),
  ('CASHIER', 'Caixa'),
  ('WAITER', 'Garçom'),
  ('KITCHEN', 'Cozinha')
on conflict (code) do nothing;

insert into public.plans (code, name) values
  ('FREE', 'Free'),
  ('BASIC', 'Basic'),
  ('PRO', 'Pro'),
  ('ENTERPRISE', 'Enterprise')
on conflict (code) do nothing;
