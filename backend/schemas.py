"""Pydantic schemas for request/response validation."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


# --- Auth ---

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# --- Reconciliation ---

class RecordResponse(BaseModel):
    id: str
    swo: Optional[str] = None
    swo_stankhelp: Optional[str] = None
    cliente: Optional[str] = None
    serial: Optional[str] = None
    equipamento: Optional[str] = None
    tipo_atendimento: Optional[str] = None
    atividade: Optional[str] = None
    cidade: Optional[str] = None
    data_atendimento: Optional[str] = None
    distancia_km: Optional[float] = None
    outras_despesas: Optional[float] = None
    quilometragem: Optional[float] = None
    hospedagem: Optional[float] = None
    reembolso_total: Optional[float] = None
    mdo: Optional[float] = None
    tecnico: Optional[str] = None
    contrato: Optional[str] = None
    observacoes: Optional[str] = None
    status: str
    divergencias: Optional[str] = None

    model_config = {"from_attributes": True}


class ReconciliationSummary(BaseModel):
    id: str
    reference_month: str
    philips_filename: Optional[str] = None
    stankhelp_filename: Optional[str] = None
    philips_count: int
    stankhelp_count: int
    conciliados_count: int
    divergencias_count: int
    only_philips_count: int
    only_stank_count: int
    total_reembolso: float
    total_mdo: float
    created_at: datetime

    model_config = {"from_attributes": True}


class ReconciliationDetail(ReconciliationSummary):
    records: list[RecordResponse] = []


MAX_RECORDS_PER_CATEGORY = 10000  # limite de defesa contra payloads abusivos


class ReconciliationUploadResult(BaseModel):
    """Resultado retornado apos upload e conciliacao (antes de salvar no banco)."""
    philips_count: int = Field(ge=0, le=MAX_RECORDS_PER_CATEGORY)
    stankhelp_count: int = Field(ge=0, le=MAX_RECORDS_PER_CATEGORY)
    conciliados_count: int = Field(ge=0, le=MAX_RECORDS_PER_CATEGORY)
    divergencias_count: int = Field(ge=0, le=MAX_RECORDS_PER_CATEGORY)
    only_philips_count: int = Field(ge=0, le=MAX_RECORDS_PER_CATEGORY)
    only_stank_count: int = Field(ge=0, le=MAX_RECORDS_PER_CATEGORY)
    total_reembolso: float
    total_mdo: float
    conciliados: list[dict] = Field(max_length=MAX_RECORDS_PER_CATEGORY)
    divergencias: list[dict] = Field(max_length=MAX_RECORDS_PER_CATEGORY)
    only_philips: list[dict] = Field(max_length=MAX_RECORDS_PER_CATEGORY)
    only_stank: list[dict] = Field(max_length=MAX_RECORDS_PER_CATEGORY)


class SaveReconciliationRequest(BaseModel):
    reference_month: str  # "2026-01"
    philips_filename: str
    stankhelp_filename: str
    result: ReconciliationUploadResult


# --- Reports ---

class DashboardResponse(BaseModel):
    total_reembolso: float
    total_conciliados: int
    total_divergencias: int
    total_faltando: int
    recent: list[ReconciliationSummary]


class MonthlyDataPoint(BaseModel):
    month: str
    reembolso: float
    conciliados: int
    divergencias: int


class TopClientPoint(BaseModel):
    cliente: str
    divergencias: int


class TipoPoint(BaseModel):
    tipo: str
    valor: float
    count: int
