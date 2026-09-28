"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuth } from "@/hooks/use-auth";
import { createCashMovement, getOpenCashRegister, listCashMovements } from "@/services/operations";
import { formatCurrency, formatDateTime, friendlyError } from "@/lib/utils";

export default function CashMovementsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [type, setType] = useState("WITHDRAWAL");
  const [amount, setAmount] = useState("0");
  const [notes, setNotes] = useState("");

  const { data: register } = useQuery({
    queryKey: ["cash", user?.organization.id],
    enabled: Boolean(user),
    queryFn: () => getOpenCashRegister(user!.organization.id),
  });
  const { data: movements } = useQuery({
    queryKey: ["cash-movements", register?.id],
    enabled: Boolean(register?.id),
    queryFn: () => listCashMovements(register!.id),
  });

  async function submit() {
    try {
      await createCashMovement(type, Number(amount), notes);
      toast.success("Movimentação registrada.");
      queryClient.invalidateQueries({ queryKey: ["cash-movements", register?.id] });
      setAmount("0");
      setNotes("");
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível registrar a movimentação."));
    }
  }

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Nova movimentação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WITHDRAWAL">Sangria</SelectItem>
                  <SelectItem value="SUPPLY">Suprimento</SelectItem>
                  <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <Button className="w-full" onClick={submit} disabled={!register}>
              Registrar
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Histórico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!movements?.length ? (
              <EmptyState title="Sem movimentações" />
            ) : (
              movements.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                  <div>
                    <div className="font-medium">{m.type}</div>
                    <div className="text-xs text-muted-foreground">{formatDateTime(m.created_at)}</div>
                  </div>
                  <div className="font-semibold">{formatCurrency(m.amount)}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
