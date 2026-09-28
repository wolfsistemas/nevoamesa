"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PublicFooter, PublicHeader } from "@/components/marketing/public-header";
import { invokeFunction } from "@/services/edge";
import { useAuth } from "@/hooks/use-auth";
import { signupSchema, type SignupValues } from "@/schemas";
import { FALLBACK_PLANS } from "@/lib/constants";
import { friendlyError } from "@/lib/utils";

function SignupInner() {
  const searchParams = useSearchParams();
  const initialPlan = (searchParams.get("plan") || "FREE").toUpperCase();
  const router = useRouter();
  const { signIn } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      restaurant_name: "",
      full_name: "",
      email: "",
      password: "",
      phone: "",
      plan_code: ["FREE", "BASIC", "PRO", "ENTERPRISE"].includes(initialPlan)
        ? (initialPlan as SignupValues["plan_code"])
        : "FREE",
      accept_terms: false,
      accept_privacy: false,
    },
  });

  async function onSubmit(values: SignupValues) {
    setSubmitting(true);
    try {
      await invokeFunction("signup-tenant", values);
      await signIn(values.email, values.password);
      toast.success("Restaurante criado. Bem-vindo ao RestaurantOS.");
      router.replace("/dashboard/");
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível criar a conta."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background">
      <PublicHeader />
      <div className="mx-auto max-w-xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Criar restaurante</CardTitle>
            <CardDescription>Sua organização, seu usuário owner e 14 dias de trial nos planos pagos.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="space-y-2">
                <Label>Nome do restaurante</Label>
                <Input {...form.register("restaurant_name")} />
                {form.formState.errors.restaurant_name ? (
                  <p className="text-xs text-danger">{form.formState.errors.restaurant_name.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Seu nome</Label>
                <Input {...form.register("full_name")} />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" autoComplete="email" {...form.register("email")} />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input type="password" autoComplete="new-password" {...form.register("password")} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input {...form.register("phone")} />
              </div>
              <div className="space-y-2">
                <Label>Plano</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  {...form.register("plan_code")}
                >
                  {FALLBACK_PLANS.map((plan) => (
                    <option key={plan.code} value={plan.code}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" {...form.register("accept_terms")} />
                <span>
                  Li e aceito os{" "}
                  <Link href="/termos/" className="text-primary hover:underline">
                    Termos de Uso
                  </Link>
                  .
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" {...form.register("accept_privacy")} />
                <span>
                  Li e aceito a{" "}
                  <Link href="/privacidade/" className="text-primary hover:underline">
                    Política de Privacidade
                  </Link>{" "}
                  (LGPD).
                </span>
              </label>
              <Button className="w-full" disabled={submitting}>
                {submitting ? "Criando..." : "Criar conta"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Já tem conta?{" "}
                <Link href="/login/" className="text-primary hover:underline">
                  Entrar
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
      <PublicFooter />
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-muted-foreground">Carregando cadastro...</div>
      }
    >
      <SignupInner />
    </Suspense>
  );
}
