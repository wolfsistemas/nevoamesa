# RestaurantOS (NevoaMesa)

SaaS de gestão interna para restaurantes, com módulos de **garçom**, **cozinha (KDS)**, **caixa** e **administração**.

Stack: Next.js (export estático) + TypeScript + Tailwind + shadcn/ui + Supabase (Auth, PostgreSQL, RLS, Realtime, Storage, Edge Functions) + PWA.

## Requisitos

- Node.js 22+
- npm
- Conta no [Supabase](https://supabase.com)

## Instalação

```bash
npm install
```

## Configuração

Copie o arquivo de exemplo:

```bash
cp .env.example .env.local
```

Variáveis:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
NEXT_PUBLIC_BASE_PATH=
NEXT_PUBLIC_APP_NAME=RestaurantOS
```

Nunca coloque `SERVICE_ROLE_KEY` no frontend.

## Supabase

### 1. Criar o projeto

Crie um projeto no painel do Supabase.

### 2. Executar migrations

No SQL Editor, execute:

- `supabase/migrations/20260328000000_init.sql`

Ou, com a CLI:

```bash
npx supabase db push
```

### 3. Seed

Execute `supabase/seed.sql` no SQL Editor.

O seed de demonstração (restaurante, mesas, produtos e usuários) é aplicado automaticamente no ambiente de testes. Usuários demo:

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Owner | owner@demo.restaurantos.app | Demo@12345 |
| Admin | admin@demo.restaurantos.app | Demo@12345 |
| Caixa | caixa@demo.restaurantos.app | Demo@12345 |
| Garçom | garcom@demo.restaurantos.app | Demo@12345 |
| Cozinha | cozinha@demo.restaurantos.app | Demo@12345 |

### 4. Auth

- Provider: e-mail + senha
- Confirme o Site URL e Redirect URLs no painel (Auth > URL Configuration)
- Recuperação de senha usa `/reset-password/`

### 5. Realtime

A migration adiciona as tabelas críticas à publicação `supabase_realtime`.

Confirme em Database > Replication:

- `orders`
- `order_items`
- `kitchen_tickets`
- `tables`
- `attendances`
- `sales`
- `cash_registers`
- `payments`

### 6. Edge Functions

Funções em `supabase/functions`:

- `create-order`
- `close-sale`
- `process-payment`
- `open-cash-register`
- `close-cash-register`
- `cash-movement`
- `cancel-order`
- `transfer-table`
- `split-payment`
- `inventory-movement`
- `create-user`
- `signup-tenant` (JWT desligado)
- `create-subscription`
- `cancel-subscription`
- `mp-webhook` (JWT desligado)
- `send-push`
- `refund-sale` (estorno de venda)

Secrets extras das functions:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `MP_ACCESS_TOKEN` (opcional até a cobrança real)
- `MP_WEBHOOK_SECRET` (valida a assinatura do webhook)

Publicar:

```bash
npx supabase functions deploy
```

Secrets das functions ficam no projeto Supabase. O frontend só usa a anon key.

## Desenvolvimento

```bash
npm run dev
```

Abra `http://localhost:3000`.

## Build

```bash
npm run build
```

O frontend é gerado em `out/` (compatível com GitHub Pages).

## GitHub Actions

O workflow `.github/workflows/deploy.yml` faz:

1. `npm ci`
2. `npm run build`
3. publicação no GitHub Pages

Secrets necessários no repositório:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_BASE_PATH` (ex.: `/nevoamesa` se o site for `usuario.github.io/nevoamesa`)

## Fluxo principal

1. Login
2. Garçom abre mesa
3. Adiciona produtos / adicionais / observação
4. Envia pedido
5. Cozinha recebe em tempo real
6. Cozinha marca como pronto
7. Garçom solicita fechamento
8. Caixa recebe pagamento
9. Mesa é liberada
10. Venda, caixa e auditoria são registrados

## Multi-tenant e segurança

- Cada restaurante é uma `organization`
- Toda entidade operacional tem `organization_id`
- RLS valida a organização pelo usuário autenticado
- Operações financeiras passam por Edge Functions + transações / idempotência
- Roles: OWNER, ADMIN, MANAGER, CASHIER, WAITER, KITCHEN

## PWA

O app instala como RestaurantOS (Android, iPhone, tablet e desktop), com manifest e service worker.

## Landing, planos e LGPD

- Home pública em `/` com recursos e planos
- Cadastro self-serve em `/signup/` (cria organization + OWNER)
- Termos em `/termos/` e privacidade LGPD em `/privacidade/`
- Assinatura e cancelamento em `/admin/assinatura/`
- Mercado Pago Assinatura fica pré-vinculado; sem `MP_ACCESS_TOKEN` o plano entra em trial

## Push e impressão

- Web Push (VAPID) para novos tickets da cozinha
- Impressão Bluetooth ESC/POS na tela `/cozinha/`
