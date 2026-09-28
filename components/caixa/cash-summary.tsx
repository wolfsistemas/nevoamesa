"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { CashMovement, CashRegister } from "@/types";

export function CashSummary({
  register,
  movements,
}: {
  register: CashRegister;
  movements: CashMovement[];
}) {
  const sum = (type: string) =>
    movements.filter((m) => m.type === type).reduce((acc, m) => acc + Number(m.amount), 0);
  const method = (value: string) =>
    movements
      .filter((m) => m.type === "SALE" && m.payment_method === value)
      .reduce((acc, m) => acc + Number(m.amount), 0);

  const sales = sum("SALE");
  const supplies = sum("SUPPLY");
  const withdrawals = sum("WITHDRAWAL");
  const expected = Number(register.opening_amount) + sales + supplies - withdrawals;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Valor inicial</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-bold">{formatCurrency(register.opening_amount)}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Vendas</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-bold">{formatCurrency(sales)}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Esperado</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-bold text-primary">{formatCurrency(expected)}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Dinheiro / PIX / Cartões</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div>Dinheiro: {formatCurrency(method("CASH"))}</div>
          <div>PIX: {formatCurrency(method("PIX"))}</div>
          <div>Débito: {formatCurrency(method("DEBIT"))}</div>
          <div>Crédito: {formatCurrency(method("CREDIT"))}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Sangrias</CardTitle>
        </CardHeader>
        <CardContent className="text-xl font-semibold text-danger">{formatCurrency(withdrawals)}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Suprimentos</CardTitle>
        </CardHeader>
        <CardContent className="text-xl font-semibold text-success">{formatCurrency(supplies)}</CardContent>
      </Card>
    </div>
  );
}
