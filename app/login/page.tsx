"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { loginSchema, type LoginValues } from "@/schemas";
import { friendlyError } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setSubmitting(true);
    try {
      await signIn(values.email, values.password);
      toast.success("Bem-vindo ao RestaurantOS");
      router.replace("/");
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível entrar."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 text-sm font-semibold text-primary">{APP_NAME}</div>
          <CardTitle>Entrar</CardTitle>
          <CardDescription>Use o e-mail e senha do seu restaurante.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" autoComplete="current-password" {...form.register("password")} />
            </div>
            <Button className="w-full" type="submit" disabled={submitting}>
              {submitting ? "Entrando..." : "Entrar"}
            </Button>
            <div className="flex items-center justify-between text-sm">
              <Link href="/forgot-password/" className="text-primary hover:underline">
                Esqueci minha senha
              </Link>
              <Link href="/signup/" className="text-primary hover:underline">
                Criar restaurante
              </Link>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              <Link href="/" className="hover:underline">
                Voltar à página inicial
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
