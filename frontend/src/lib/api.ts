const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiClient {
  setToken(token: string | null) {
    if (typeof window !== "undefined") {
      if (token) localStorage.setItem("token", token);
      else localStorage.removeItem("token");
    }
  }

  getToken(): string | null {
    // Sempre le do localStorage para sincronizar entre abas e evitar cache stale
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token");
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {};
    const token = this.getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`${API_URL}${path}`, { ...options, headers: { ...headers, ...options.headers as Record<string, string> } });

    if (res.status === 401) {
      this.setToken(null);
      if (typeof window !== "undefined") window.location.href = "/login";
      throw new Error("Nao autorizado");
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Erro desconhecido" }));
      throw new Error(err.detail || `Erro ${res.status}`);
    }

    if (res.headers.get("content-type")?.includes("application/json")) {
      return res.json();
    }
    return res as unknown as T;
  }

  // Auth
  async login(email: string, password: string) {
    const data = await this.request<{ access_token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.access_token);
    return data;
  }

  async register(email: string, password: string, name: string) {
    const data = await this.request<{ access_token: string; user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
    this.setToken(data.access_token);
    return data;
  }

  logout() {
    this.setToken(null);
  }

  // Reconciliation
  async uploadAndReconcile(
    philipsFile: File,
    stankhelpFile: File,
    referenceMonth: string,
    representante: string = "STANK HELP",
  ) {
    const form = new FormData();
    form.append("philips_file", philipsFile);
    form.append("stankhelp_file", stankhelpFile);
    form.append("reference_month", referenceMonth);
    form.append("representante", representante);
    return this.request<ReconciliationUploadResult>("/api/reconciliation/upload", {
      method: "POST",
      body: form,
    });
  }

  async saveReconciliation(data: SaveRequest) {
    return this.request<ReconciliationSummary>("/api/reconciliation/save", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async listReconciliations(skip = 0, limit = 20, month?: string) {
    const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    if (month) params.set("month", month);
    return this.request<ReconciliationSummary[]>(`/api/reconciliation/?${params}`);
  }

  async getReconciliation(id: string) {
    return this.request<ReconciliationDetail>(`/api/reconciliation/${id}`);
  }

  async exportExcel(id: string) {
    const token = this.getToken();
    const res = await fetch(`${API_URL}/api/reconciliation/${id}/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.status === 401) {
      this.setToken(null);
      if (typeof window !== "undefined") window.location.href = "/login";
      throw new Error("Sessao expirada");
    }
    if (!res.ok) throw new Error("Erro ao exportar");
    return res.blob();
  }

  // Reports
  async getDashboard() {
    return this.request<DashboardData>("/api/reports/dashboard");
  }

  async getMonthlyData() {
    return this.request<MonthlyDataPoint[]>("/api/reports/monthly");
  }

  async getTopClients(limit = 10) {
    return this.request<TopClientPoint[]>(`/api/reports/top-clients?limit=${limit}`);
  }

  async getByType() {
    return this.request<TipoPoint[]>("/api/reports/by-type");
  }
}

export const api = new ApiClient();

// Types
export interface User {
  id: string;
  email: string;
  name: string;
}

export interface ReconciliationUploadResult {
  philips_count: number;
  stankhelp_count: number;
  conciliados_count: number;
  divergencias_count: number;
  only_philips_count: number;
  only_stank_count: number;
  total_reembolso: number;
  total_mdo: number;
  conciliados: Record<string, unknown>[];
  divergencias: Record<string, unknown>[];
  only_philips: Record<string, unknown>[];
  only_stank: Record<string, unknown>[];
}

export interface SaveRequest {
  reference_month: string;
  philips_filename: string;
  stankhelp_filename: string;
  result: ReconciliationUploadResult;
}

export interface ReconciliationSummary {
  id: string;
  reference_month: string;
  philips_filename: string;
  stankhelp_filename: string;
  philips_count: number;
  stankhelp_count: number;
  conciliados_count: number;
  divergencias_count: number;
  only_philips_count: number;
  only_stank_count: number;
  total_reembolso: number;
  total_mdo: number;
  created_at: string;
}

export interface ReconciliationDetail extends ReconciliationSummary {
  records: RecordItem[];
}

export interface RecordItem {
  id: string;
  swo: string;
  swo_stankhelp: string;
  cliente: string;
  serial: string;
  equipamento: string;
  tipo_atendimento: string;
  atividade: string;
  cidade: string;
  data_atendimento: string;
  distancia_km: number | null;
  outras_despesas: number | null;
  quilometragem: number | null;
  hospedagem: number | null;
  reembolso_total: number | null;
  mdo: number | null;
  tecnico: string;
  contrato: string;
  observacoes: string;
  status: string;
  divergencias: string;
}

export interface DashboardData {
  total_reembolso: number;
  total_conciliados: number;
  total_divergencias: number;
  total_faltando: number;
  recent: ReconciliationSummary[];
}

export interface MonthlyDataPoint {
  month: string;
  reembolso: number;
  conciliados: number;
  divergencias: number;
}

export interface TopClientPoint {
  cliente: string;
  divergencias: number;
}

export interface TipoPoint {
  tipo: string;
  valor: number;
  count: number;
}
