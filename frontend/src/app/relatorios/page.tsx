"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, type MonthlyDataPoint, type TopClientPoint, type TipoPoint } from "@/lib/api";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Bar, BarChart, XAxis, YAxis, CartesianGrid,
  PieChart, Pie, Cell,
  Line, ComposedChart,
} from "recharts";

const PIE_COLORS = [
  "oklch(0.55 0.2 260)",
  "oklch(0.65 0.18 145)",
  "oklch(0.72 0.18 55)",
  "oklch(0.6 0.2 25)",
  "oklch(0.6 0.15 300)",
  "oklch(0.5 0.15 200)",
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL", minimumFractionDigits: 0,
  }).format(value);
}

export default function RelatoriosPage() {
  const [monthly, setMonthly] = useState<MonthlyDataPoint[]>([]);
  const [topClients, setTopClients] = useState<TopClientPoint[]>([]);
  const [byType, setByType] = useState<TipoPoint[]>([]);

  useEffect(() => {
    api.getMonthlyData().then(setMonthly).catch(() => {});
    api.getTopClients().then(setTopClients).catch(() => {});
    api.getByType().then(setByType).catch(() => {});
  }, []);

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold">Relatorios</h2>
          <p className="text-muted-foreground">Analises e graficos das conciliacoes</p>
        </div>

        {/* Evolucao Mensal */}
        <Card>
          <CardHeader>
            <CardTitle>Evolucao Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            {monthly.length > 0 ? (
              <ChartContainer
                config={{
                  conciliados: { label: "Conciliados", color: "var(--chart-2)" },
                  divergencias: { label: "Divergencias", color: "var(--chart-3)" },
                }}
                className="h-72 w-full"
              >
                <ComposedChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="conciliados" fill="var(--color-conciliados)" radius={[4, 4, 0, 0]} />
                  <Line dataKey="divergencias" stroke="var(--color-divergencias)" strokeWidth={2} />
                </ComposedChart>
              </ChartContainer>
            ) : (
              <p className="text-muted-foreground text-center py-8">Sem dados ainda</p>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Clientes Divergentes */}
          <Card>
            <CardHeader>
              <CardTitle>Top Clientes com Divergencias</CardTitle>
            </CardHeader>
            <CardContent>
              {topClients.length > 0 ? (
                <ChartContainer
                  config={{
                    divergencias: { label: "Divergencias", color: "var(--chart-4)" },
                  }}
                  className="h-72 w-full"
                >
                  <BarChart data={topClients} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis
                      type="category"
                      dataKey="cliente"
                      width={180}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickFormatter={(v: string) => v.length > 25 ? v.slice(0, 25) + "..." : v}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="divergencias" fill="var(--color-divergencias)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <p className="text-muted-foreground text-center py-8">Sem dados ainda</p>
              )}
            </CardContent>
          </Card>

          {/* Reembolso por Tipo */}
          <Card>
            <CardHeader>
              <CardTitle>Reembolso por Tipo de Atendimento</CardTitle>
            </CardHeader>
            <CardContent>
              {byType.length > 0 ? (
                <div className="flex items-center gap-6">
                  <ChartContainer
                    config={{
                      valor: { label: "Valor", color: "var(--chart-1)" },
                    }}
                    className="h-72 w-64"
                  >
                    <PieChart>
                      <Pie
                        data={byType}
                        dataKey="valor"
                        nameKey="tipo"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        innerRadius={50}
                      >
                        {byType.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ChartContainer>
                  <div className="space-y-2 flex-1">
                    {byType.map((item, i) => (
                      <div key={item.tipo} className="flex items-center gap-2 text-sm">
                        <div
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                        <span className="truncate flex-1 text-muted-foreground">{item.tipo}</span>
                        <span className="font-medium">{formatCurrency(item.valor)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">Sem dados ainda</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
