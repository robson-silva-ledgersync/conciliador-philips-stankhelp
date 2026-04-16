"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DollarSign, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { api, type DashboardData, type MonthlyDataPoint } from "@/lib/api";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, XAxis, YAxis, CartesianGrid, Line, ComposedChart } from "recharts";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [monthly, setMonthly] = useState<MonthlyDataPoint[]>([]);

  useEffect(() => {
    api.getDashboard().then(setData).catch(() => {});
    api.getMonthlyData().then(setMonthly).catch(() => {});
  }, []);

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-muted-foreground">Visao geral das conciliacoes</p>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Reembolsado"
            value={data ? formatCurrency(data.total_reembolso) : "-"}
            icon={DollarSign}
            color="blue"
          />
          <MetricCard
            title="Conciliados"
            value={data?.total_conciliados ?? "-"}
            icon={CheckCircle2}
            color="green"
          />
          <MetricCard
            title="Divergencias"
            value={data?.total_divergencias ?? "-"}
            icon={AlertTriangle}
            color="yellow"
          />
          <MetricCard
            title="Faltando"
            value={data?.total_faltando ?? "-"}
            icon={XCircle}
            color="red"
          />
        </div>

        {/* Monthly Chart */}
        {monthly.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Reembolso por Mes</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  reembolso: { label: "Reembolso (R$)", color: "var(--chart-1)" },
                  conciliados: { label: "Conciliados", color: "var(--chart-2)" },
                }}
                className="h-72 w-full"
              >
                <ComposedChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="reembolso" fill="var(--color-reembolso)" radius={[4, 4, 0, 0]} />
                  <Line dataKey="conciliados" stroke="var(--color-conciliados)" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {/* Recent */}
        <Card>
          <CardHeader>
            <CardTitle>Conciliacoes Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {data && data.recent.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Mes Ref.</TableHead>
                    <TableHead>Conciliados</TableHead>
                    <TableHead>Divergencias</TableHead>
                    <TableHead>Reembolso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recent.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{formatDate(r.created_at)}</TableCell>
                      <TableCell>{r.reference_month}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400">
                          {r.conciliados_count}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-amber-500/10 text-amber-400">
                          {r.divergencias_count}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(r.total_reembolso)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Nenhuma conciliacao realizada ainda. Comece na pagina de Conciliacao.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
