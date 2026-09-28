"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChefHat, CreditCard, Printer, ShieldCheck, Smartphone, UtensilsCrossed, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicFooter, PublicHeader } from "@/components/marketing/public-header";
import { useAuth } from "@/hooks/use-auth";
import { APP_NAME } from "@/lib/constants";
import { listPublicPlans, planPriceLabel } from "@/lib/plans";
import type { Plan } from "@/types";

const FEATURES = [
  {
    icon: UtensilsCrossed,
    title: "Garçom no salão",
    text: "Abra mesa, lance itens, observações e solicite o fechamento no celular.",
  },
  {
    icon: ChefHat,
    title: "KDS em tempo real",
    text: "A cozinha recebe tickets na hora, com setores, tempo e alerta visual.",
  },
  {
    icon: CreditCard,
    title: "Caixa e PIX",
    text: "Abertura, sangria, split, crédito, débito e PIX com auditoria.",
  },
  {
    icon: Printer,
    title: "Impressão Bluetooth",
    text: "Imprima o ticket ESC/POS na impressora da cozinha pelo navegador.",
  },
  {
    icon: Wifi,
    title: "Push no celular",
    text: "Novo pedido chega como notificação, mesmo com a aba em segundo plano.",
  },
  {
    icon: ShieldCheck,
    title: "Multi-tenant e LGPD",
    text: "Cada restaurante isolado por RLS, com termos, privacidade e consentimento.",
  },
];

export default function HomePage() {
  const { loading, user, homePath } = useAuth();
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    if (!loading && user) router.replace(`${homePath}/`);
  }, [loading, user, homePath, router]);

  useEffect(() => {
    listPublicPlans().then(setPlans);
  }, []);

  if (!loading && user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground">
        Abrindo {APP_NAME}...
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <PublicHeader />
      <main>
        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">SaaS para restaurantes</p>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
              Salão, cozinha e caixa no mesmo ritmo.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              {APP_NAME} opera o restaurante em tempo real: pedido do garçom, ticket na cozinha,
              pagamento no caixa e mesa livre. Multi-tenant, PWA e pronto para o celular.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/signup/">Criar meu restaurante</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login/">Já tenho conta</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">14 dias de trial nos planos pagos. Sem cartão no Free.</p>
          </div>
          <div className="rounded-3xl border border-border bg-surface p-6 shadow-soft">
            <div className="mb-4 text-sm font-medium text-muted-foreground">Fluxo do salão</div>
            <ol className="space-y-3 text-sm">
              {[
                "Garçom abre a mesa e lança o pedido",
                "Cozinha recebe push e imprime no Bluetooth",
                "Pedido pronto volta para o salão",
                "Caixa recebe PIX, cartão ou dinheiro",
                "Mesa é liberada e a venda entra no relatório",
              ].map((step, i) => (
                <li key={step} className="flex gap-3 rounded-xl bg-accent/60 p-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <span className="pt-1">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="recursos" className="border-y border-border bg-surface/50 py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="mb-8 text-3xl font-bold">Tudo que o turno precisa</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <Card key={feature.title}>
                    <CardHeader>
                      <Icon className="mb-2 h-6 w-6 text-primary" />
                      <CardTitle className="text-lg">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">{feature.text}</CardContent>
                  </Card>
                );
              })}
            </div>
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Smartphone className="h-4 w-4" /> PWA instalável em Android, iPhone, tablet e desktop.
            </div>
          </div>
        </section>

        <section id="planos" className="mx-auto max-w-6xl px-4 py-16">
          <div className="mb-8">
            <h2 className="text-3xl font-bold">Planos</h2>
            <p className="text-muted-foreground">Comece no Free. Assinatura Mercado Pago nos planos pagos.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => (
              <Card key={plan.code} className={plan.highlighted ? "border-primary shadow-soft" : undefined}>
                <CardHeader>
                  <div className="text-sm text-muted-foreground">{plan.name}</div>
                  <CardTitle className="text-3xl">
                    {planPriceLabel(plan)}
                    {plan.price_cents > 0 ? <span className="text-sm font-normal text-muted-foreground">/mês</span> : null}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                  <ul className="space-y-2 text-sm">
                    {plan.features.map((item) => (
                      <li key={item}>· {item}</li>
                    ))}
                  </ul>
                  <Button asChild className="w-full" variant={plan.highlighted ? "default" : "outline"}>
                    <Link href={`/signup/?plan=${plan.code}`}>
                      {plan.code === "ENTERPRISE" ? "Falar com vendas" : "Começar"}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
