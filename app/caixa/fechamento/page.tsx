"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { CashSummary } from "@/components/caixa/cash-summary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, LoadingState } from "@/components/ui/empty-state";
import { useAuth } from "@/hooks/use-auth";
import {
  closeCashRegister,
  closeSale,
  getOpenCashRegister,
  listAttendanceOrders,
  listCashMovements,
  listWaitingAttendances,
} from "@/services/operations";
import { PAYMENT_LABEL } from "@/lib/constants";
import { formatCurrency, friendlyError } from "@/lib/utils";
import type { PaymentMethod } from "@/types";

function CashClosePageInner() {
  const { user } = useAuth();
  const orgId = user?.organization.id;
  const queryClient = useQueryClient();
  const search = useSearchParams();
  const selectedAttendance = search.get("attendance") ?? "";
  const [discount, setDiscount] = useState("0");
  const [serviceFee, setServiceFee] = useState(String(user?.settings.service_fee_percent ?? 10));
  const [method, setMethod] = useState<PaymentMethod>("PIX");
  const [counted, setCounted] = useState("0");
  const [paying, setPaying] = useState(false);

  const { data: register, isLoading } = useQuery({
    queryKey: ["cash", orgId],
    enabled: Boolean(orgId),
    queryFn: () => getOpenCashRegister(orgId!),
  });
  const { data: movements } = useQuery({
    queryKey: ["cash-movements", register?.id],
    enabled: Boolean(register?.id),
    queryFn: () => listCashMovements(register!.id),
  });
  const { data: waiting } = useQuery({
    queryKey: ["waiting", orgId],
    enabled: Boolean(orgId),
    queryFn: () => listWaitingAttendances(orgId!),
  });
  const attendance = waiting?.find((a) => a.id === selectedAttendance) ?? waiting?.[0];
  const { data: orders } = useQuery({
    queryKey: ["attendance-orders", attendance?.id],
    enabled: Boolean(attendance?.id),
    queryFn: () => listAttendanceOrders(attendance!.id),
  });

  const subtotal = useMemo(
    () =>
      (orders ?? []).reduce(
        (acc, order) =>
          acc +
          (order.items ?? []).reduce(
            (s, item) =>
              s +
              (Number(item.unit_price) + (item.addons ?? []).reduce((a, ad) => a + Number(ad.price), 0)) *
                item.quantity,
            0,
          ),
        0,
      ),
    [orders],
  );
  const discountAmount = Number(discount) || 0;
  const fee = ((subtotal - discountAmount) * (Number(serviceFee) || 0)) / 100;
  const total = Math.max(0, subtotal - discountAmount + fee);

  async function pay() {
    if (!attendance) return;
    setPaying(true);
    try {
      await closeSale({
        attendance_id: attendance.id,
        discount_amount: discountAmount,
        service_fee: fee,
        payments: [{ method, amount: total }],
      });
      toast.success("Pagamento recebido e mesa liberada.");
      queryClient.invalidateQueries();
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível finalizar a venda."));
    } finally {
      setPaying(false);
    }
  }

  async function closeRegister() {
    try {
      await closeCashRegister(Number(counted) || 0);
      toast.success("Caixa fechado.");
      queryClient.invalidateQueries();
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível fechar o caixa."));
    }
  }

  return (
    <AppShell>
      {isLoading ? (
        <LoadingState />
      ) : !register ? (
        <EmptyState title="Abra o caixa antes de fechar vendas." />
      ) : (
        <div className="space-y-6">
          <CashSummary register={register} movements={movements ?? []} />
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Receber conta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!attendance ? (
                  <p className="text-sm text-muted-foreground">Nenhuma conta aberta.</p>
                ) : (
                  <>
                    <div className="text-sm">Mesa {attendance.table?.number}</div>
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="space-y-1">
                      <Label>Desconto (R$)</Label>
                      <Input value={discount} onChange={(e) => setDiscount(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Taxa de serviço (%)</Label>
                      <Input value={serviceFee} onChange={(e) => setServiceFee(e.target.value)} />
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Total</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                    <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PAYMENT_LABEL).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button className="w-full" onClick={pay} disabled={paying}>
                      {paying ? "Finalizando..." : "Finalizar pagamento"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Fechar caixa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Label>Valor contado</Label>
                <Input value={counted} onChange={(e) => setCounted(e.target.value)} />
                <Button className="w-full" variant="secondary" onClick={closeRegister}>
                  Registrar fechamento
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function CashClosePage() {
  return (
    <Suspense fallback={<AppShell><LoadingState /></AppShell>}>
      <CashClosePageInner />
    </Suspense>
  );
}
