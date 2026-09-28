"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/empty-state";
import { useAuth } from "@/hooks/use-auth";
import { getSupabase } from "@/lib/supabase/client";
import { PAYMENT_LABEL } from "@/lib/constants";
import { formatCurrency, startOfDayISO } from "@/lib/utils";
import type { DashboardMetrics, PaymentMethod } from "@/types";

const COLORS = ["#F59E0B", "#22C55E", "#3B82F6", "#A855F7", "#EF4444"];

async function loadMetrics(organizationId: string): Promise<DashboardMetrics> {
  const supabase = getSupabase();
  const from = startOfDayISO();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);

  const [
    { data: sales },
    { data: weekSales },
    { data: orders },
    { data: tables },
    { data: cash },
    { data: salePayments },
    { data: orderItems },
  ] = await Promise.all([
    supabase.from("sales").select("*").eq("organization_id", organizationId).gte("created_at", from),
    supabase.from("sales").select("*").eq("organization_id", organizationId).gte("created_at", weekAgo.toISOString()),
    supabase.from("orders").select("*").eq("organization_id", organizationId).gte("created_at", from),
    supabase.from("tables").select("status").eq("organization_id", organizationId).eq("active", true),
    supabase.from("cash_registers").select("status").eq("organization_id", organizationId).eq("status", "OPEN").limit(1),
    supabase.from("sale_payments").select("method, amount, created_at").eq("organization_id", organizationId).gte("created_at", from),
    supabase.from("order_items").select("name, quantity, unit_price, created_at").eq("organization_id", organizationId).gte("created_at", from),
  ]);

  const salesTotal = (sales ?? []).reduce((acc, s) => acc + Number(s.total), 0);
  const ordersCount = (orders ?? []).length;
  const hourlyMap = new Map<string, number>();
  for (let i = 8; i <= 23; i++) hourlyMap.set(String(i).padStart(2, "0") + "h", 0);
  (sales ?? []).forEach((sale) => {
    const hour = new Date(sale.created_at).getHours().toString().padStart(2, "0") + "h";
    hourlyMap.set(hour, (hourlyMap.get(hour) ?? 0) + Number(sale.total));
  });
  const dailyMap = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dailyMap.set(d.toLocaleDateString("pt-BR", { weekday: "short" }), 0);
  }
  (weekSales ?? []).forEach((sale) => {
    const key = new Date(sale.created_at).toLocaleDateString("pt-BR", { weekday: "short" });
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + Number(sale.total));
  });
  const productMap = new Map<string, { quantity: number; total: number }>();
  (orderItems ?? []).forEach((item) => {
    const current = productMap.get(item.name) ?? { quantity: 0, total: 0 };
    current.quantity += Number(item.quantity);
    current.total += Number(item.quantity) * Number(item.unit_price);
    productMap.set(item.name, current);
  });
  const paymentsMap = new Map<PaymentMethod, number>();
  (salePayments ?? []).forEach((p) => {
    paymentsMap.set(p.method as PaymentMethod, (paymentsMap.get(p.method as PaymentMethod) ?? 0) + Number(p.amount));
  });

  return {
    sales_total: salesTotal,
    orders_count: ordersCount,
    ticket_average: ordersCount ? salesTotal / Math.max((sales ?? []).length, 1) : 0,
    occupied_tables: (tables ?? []).filter((t) => t.status === "OCCUPIED" || t.status === "WAITING_PAYMENT").length,
    free_tables: (tables ?? []).filter((t) => t.status === "FREE").length,
    preparing_orders: (orders ?? []).filter((o) => o.status === "PREPARING" || o.status === "SENT").length,
    ready_orders: (orders ?? []).filter((o) => o.status === "READY").length,
    cash_open: Boolean(cash?.length),
    hourly: Array.from(hourlyMap.entries()).map(([hour, total]) => ({ hour, total })),
    daily: Array.from(dailyMap.entries()).map(([day, total]) => ({ day, total })),
    top_products: Array.from(productMap.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5),
    payments: Array.from(paymentsMap.entries()).map(([method, total]) => ({ method, total })),
  };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", user?.organization.id],
    enabled: Boolean(user),
    queryFn: () => loadMetrics(user!.organization.id),
  });

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">{user?.organization.name}</p>
      </div>
      {isLoading || !data ? (
        <LoadingState />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric title="Faturamento do dia" value={formatCurrency(data.sales_total)} />
            <Metric title="Pedidos" value={String(data.orders_count)} />
            <Metric title="Ticket médio" value={formatCurrency(data.ticket_average)} />
            <Metric title="Caixa" value={data.cash_open ? "Aberto" : "Fechado"} />
            <Metric title="Mesas ocupadas" value={String(data.occupied_tables)} />
            <Metric title="Mesas livres" value={String(data.free_tables)} />
            <Metric title="Em preparo" value={String(data.preparing_orders)} />
            <Metric title="Prontos" value={String(data.ready_orders)} />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Vendas por hora</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.hourly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#242A33" />
                    <XAxis dataKey="hour" stroke="#94A3B8" />
                    <YAxis stroke="#94A3B8" />
                    <Tooltip />
                    <Bar dataKey="total" fill="#F59E0B" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Vendas por dia</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#242A33" />
                    <XAxis dataKey="day" stroke="#94A3B8" />
                    <YAxis stroke="#94A3B8" />
                    <Tooltip />
                    <Bar dataKey="total" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Produtos mais vendidos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.top_products.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem vendas ainda.</p>
                ) : (
                  data.top_products.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <span>{item.name}</span>
                      <span className="text-muted-foreground">
                        {item.quantity} · {formatCurrency(item.total)}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Formas de pagamento</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {data.payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem pagamentos ainda.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.payments} dataKey="total" nameKey="method" innerRadius={50} outerRadius={80}>
                        {data.payments.map((entry, index) => (
                          <Cell key={entry.method} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name) => [
                          formatCurrency(Number(value)),
                          PAYMENT_LABEL[name as PaymentMethod] ?? String(name),
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-bold">{value}</CardContent>
    </Card>
  );
}
