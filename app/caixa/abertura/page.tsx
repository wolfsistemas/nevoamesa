"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cashOpenSchema } from "@/schemas";
import { openCashRegister } from "@/services/operations";
import { friendlyError } from "@/lib/utils";

export default function CashOpenPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm({
    resolver: zodResolver(cashOpenSchema),
    defaultValues: { opening_amount: 0, notes: "" },
  });

  async function onSubmit(values: { opening_amount: number; notes?: string | null }) {
    setSubmitting(true);
    try {
      await openCashRegister(values.opening_amount, values.notes ?? undefined);
      toast.success("Caixa aberto.");
      router.push("/caixa/");
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível abrir o caixa."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>Abrir caixa</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <Label>Valor inicial</Label>
              <Input type="number" step="0.01" {...form.register("opening_amount")} />
            </div>
            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea {...form.register("notes")} />
            </div>
            <Button className="w-full" disabled={submitting}>
              {submitting ? "Abrindo..." : "Abrir caixa"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AppShell>
  );
}
