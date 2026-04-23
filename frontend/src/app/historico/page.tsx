"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, Trash2 } from "lucide-react";
import { api, type ReconciliationSummary } from "@/lib/api";
import { toast } from "sonner";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL", minimumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function HistoricoPage() {
  const [data, setData] = useState<ReconciliationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listReconciliations(0, 50)
      .then(setData)
      .catch(() => toast.error("Erro ao carregar historico"))
      .finally(() => setLoading(false));
  }, []);

  const handleExport = async (id: string, month: string) => {
    try {
      const blob = await api.exportExcel(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Conciliacao_${month}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel exportado!");
    } catch {
      toast.error("Erro ao exportar");
    }
  };

  const handleDelete = async (id: string, month: string) => {
    if (!confirm(`Excluir conciliacao de ${month}? Esta acao nao pode ser desfeita.`)) return;
    try {
      await api.deleteReconciliation(id);
      setData((prev) => prev.filter((r) => r.id !== id));
      toast.success("Conciliacao excluida");
    } catch {
      toast.error("Erro ao excluir");
    }
  };

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold">Historico</h2>
          <p className="text-muted-foreground">
            Todas as conciliacoes salvas no sistema
          </p>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : data.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Mes Ref.</TableHead>
                    <TableHead>Philips</TableHead>
                    <TableHead>Stankhelp</TableHead>
                    <TableHead>Conciliados</TableHead>
                    <TableHead>Divergencias</TableHead>
                    <TableHead>Faltando</TableHead>
                    <TableHead className="text-right">Reembolso</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{formatDate(r.created_at)}</TableCell>
                      <TableCell className="font-medium">{r.reference_month}</TableCell>
                      <TableCell>{r.philips_count}</TableCell>
                      <TableCell>{r.stankhelp_count}</TableCell>
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
                      <TableCell>
                        <Badge variant="secondary" className="bg-red-500/10 text-red-400">
                          {r.only_philips_count}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(r.total_reembolso)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleExport(r.id, r.reference_month)}
                            title="Exportar Excel"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(r.id, r.reference_month)}
                            title="Excluir"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-12">
                Nenhuma conciliacao salva ainda.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
