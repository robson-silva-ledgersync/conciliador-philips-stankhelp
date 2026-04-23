"use client";

import { useCallback, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { MetricCard } from "@/components/metric-card";
import { Upload, CheckCircle2, AlertTriangle, XCircle, Save, Download, FileSpreadsheet } from "lucide-react";
import { api, type ReconciliationUploadResult } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function formatCurrency(value: number | null | undefined) {
  if (value == null || value === 0) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

interface FileDropProps {
  label: string;
  file: File | null;
  onFile: (f: File) => void;
}

function FileDrop({ label, file, onFile }: FileDropProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) onFile(f);
    },
    [onFile]
  );

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
        dragging ? "border-primary bg-primary/5" : file ? "border-emerald-500/50 bg-emerald-500/5" : "border-border hover:border-primary/50"
      )}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      {file ? (
        <div className="flex items-center justify-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          <div>
            <p className="font-medium text-emerald-400">{file.name}</p>
            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
        </div>
      ) : (
        <>
          <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">{label}</p>
          <p className="text-xs text-muted-foreground mt-1">Arraste ou clique para selecionar</p>
        </>
      )}
    </div>
  );
}

function RecordTable({ records, showDivergencias }: { records: Record<string, unknown>[]; showDivergencias?: boolean }) {
  if (!records.length) return <p className="text-muted-foreground text-center py-4">Nenhum registro</p>;

  return (
    <div className="overflow-x-auto max-h-96">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>SWO</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Equipamento</TableHead>
            <TableHead>Tipo Atend.</TableHead>
            <TableHead className="text-right">Reembolso</TableHead>
            {showDivergencias && <TableHead>Divergencias</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((r, i) => (
            <TableRow key={i}>
              <TableCell className="font-mono text-xs">
                {String(r["SWO"] ?? r["SWO Stankhelp"] ?? "")}
              </TableCell>
              <TableCell className="max-w-48 truncate">
                {String(r["Cliente Philips"] ?? r["Cliente"] ?? "")}
              </TableCell>
              <TableCell className="max-w-36 truncate">
                {String(r["Equipamento Philips"] ?? r["Equipamento"] ?? "")}
              </TableCell>
              <TableCell>
                {String(r["Tipo Atend Philips"] ?? r["Tipo Atendimento"] ?? "")}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(Number(r["Reembolso Total"]) || null)}
              </TableCell>
              {showDivergencias && (
                <TableCell>
                  <span className="text-amber-400 text-xs">
                    {String(r["Divergências"] ?? r["Divergencias"] ?? "")}
                  </span>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// Mapeia nome do mes em portugues (sem acentos) para numero
const MONTH_MAP: Record<string, string> = {
  janeiro: "01", fevereiro: "02", marco: "03",
  abril: "04", maio: "05", junho: "06", julho: "07",
  agosto: "08", setembro: "09", outubro: "10",
  novembro: "11", dezembro: "12",
};

function detectMonthFromFilename(filename: string): string | null {
  // Remove acentos (NFD + strip combining marks) para que "MARÇO" vire "marco"
  const normalized = filename
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

  // Padrao 1: "YYYY-MM" ou "YYYY_MM" (seguido de qualquer coisa exceto outro digito)
  const isoMatch = normalized.match(/(20\d{2})[-_\s]+(0[1-9]|1[0-2])(?!\d)/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;

  // Padrao 2: "mes - YYYY" ou "mes YYYY" (ex: "marco - 2026")
  for (const [name, num] of Object.entries(MONTH_MAP)) {
    const re = new RegExp(`\\b${name}\\b[\\s\\-_]*(20\\d{2})`);
    const m = normalized.match(re);
    if (m) return `${m[1]}-${num}`;
  }

  // Padrao 3: so o nome do mes - usa ano atual
  for (const [name, num] of Object.entries(MONTH_MAP)) {
    const re = new RegExp(`\\b${name}\\b`);
    if (re.test(normalized)) {
      return `${new Date().getFullYear()}-${num}`;
    }
  }

  return null;
}

export default function ConciliacaoPage() {
  const [philipsFile, setPhilipsFile] = useState<File | null>(null);
  const [stankhelpFile, setStankhelpFile] = useState<File | null>(null);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [monthAutoDetected, setMonthAutoDetected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ReconciliationUploadResult | null>(null);

  const handleConciliar = async () => {
    if (!philipsFile || !stankhelpFile) return;
    setLoading(true);
    try {
      const res = await api.uploadAndReconcile(philipsFile, stankhelpFile, month);
      setResult(res);
      toast.success("Conciliacao realizada com sucesso!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro na conciliacao");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result || !philipsFile || !stankhelpFile) return;
    setSaving(true);
    try {
      await api.saveReconciliation({
        reference_month: month,
        philips_filename: philipsFile.name,
        stankhelp_filename: stankhelpFile.name,
        result,
      });
      toast.success("Conciliacao salva no sistema!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPhilipsFile(null);
    setStankhelpFile(null);
    setResult(null);
    setMonthAutoDetected(false);
  };

  // Auto-detecta mes quando arquivo e selecionado (se usuario nao definiu manualmente)
  const handleStankhelpFile = (f: File) => {
    setStankhelpFile(f);
    const detected = detectMonthFromFilename(f.name);
    if (detected && !monthAutoDetected) {
      setMonth(detected);
      setMonthAutoDetected(true);
      toast.info(`Mes detectado automaticamente: ${detected}`);
    }
  };

  const handlePhilipsFile = (f: File) => {
    setPhilipsFile(f);
    // So tenta detectar pela Philips se a Stankhelp ainda nao detectou
    if (!stankhelpFile && !monthAutoDetected) {
      const detected = detectMonthFromFilename(f.name);
      if (detected) {
        setMonth(detected);
        setMonthAutoDetected(true);
        toast.info(`Mes detectado automaticamente: ${detected}`);
      }
    }
  };

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold">Nova Conciliacao</h2>
          <p className="text-muted-foreground">
            Selecione os arquivos Excel para comparar
          </p>
        </div>

        {!result ? (
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <Label>Mes Referencia</Label>
                <Input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-48"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FileDrop
                  label="Base Philips"
                  file={philipsFile}
                  onFile={handlePhilipsFile}
                />
                <FileDrop
                  label="Relatorio Stankhelp"
                  file={stankhelpFile}
                  onFile={handleStankhelpFile}
                />
              </div>

              <div className="flex justify-center">
                <Button
                  size="lg"
                  disabled={!philipsFile || !stankhelpFile || loading}
                  onClick={handleConciliar}
                >
                  {loading ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Conciliar
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Conciliados"
                value={result.conciliados_count}
                icon={CheckCircle2}
                color="green"
              />
              <MetricCard
                title="Divergencias"
                value={result.divergencias_count}
                icon={AlertTriangle}
                color="yellow"
              />
              <MetricCard
                title="Faltando (Philips)"
                value={result.only_philips_count}
                icon={XCircle}
                color="red"
              />
              <MetricCard
                title="Total Reembolso"
                value={formatCurrency(result.total_reembolso)}
                icon={FileSpreadsheet}
                color="blue"
              />
            </div>

            <p className="text-sm text-muted-foreground text-center">
              {result.philips_count} registros Philips &bull; {result.stankhelp_count} registros Stankhelp
            </p>

            {/* Detail Tabs */}
            <Card>
              <CardContent className="p-0">
                <Tabs defaultValue="conciliados">
                  <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-4 pt-3">
                    <TabsTrigger value="conciliados">
                      Conciliados ({result.conciliados_count})
                    </TabsTrigger>
                    <TabsTrigger value="divergencias">
                      Divergencias ({result.divergencias_count})
                    </TabsTrigger>
                    <TabsTrigger value="only_philips">
                      Faltando ({result.only_philips_count})
                    </TabsTrigger>
                    {result.only_stank_count > 0 && (
                      <TabsTrigger value="only_stank">
                        Somente Stankhelp ({result.only_stank_count})
                      </TabsTrigger>
                    )}
                  </TabsList>
                  <div className="p-4">
                    <TabsContent value="conciliados">
                      <RecordTable records={result.conciliados} />
                    </TabsContent>
                    <TabsContent value="divergencias">
                      <RecordTable records={result.divergencias} showDivergencias />
                    </TabsContent>
                    <TabsContent value="only_philips">
                      <RecordTable records={result.only_philips} />
                    </TabsContent>
                    <TabsContent value="only_stank">
                      <RecordTable records={result.only_stank} />
                    </TabsContent>
                  </div>
                </Tabs>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-center gap-4">
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Salvando..." : "Salvar no Sistema"}
              </Button>
              <Button variant="secondary" onClick={handleReset}>
                Nova Conciliacao
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
