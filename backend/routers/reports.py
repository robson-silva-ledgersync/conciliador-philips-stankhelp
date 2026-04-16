"""Report endpoints: dashboard metrics, charts data."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_current_user
from models import Reconciliation, ReconciliationRecord, User
from schemas import (
    DashboardResponse,
    MonthlyDataPoint,
    ReconciliationSummary,
    TopClientPoint,
    TipoPoint,
)

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Aggregate metrics for the dashboard."""
    base = db.query(Reconciliation).filter(Reconciliation.user_id == user.id)

    total_reembolso = base.with_entities(
        func.coalesce(func.sum(Reconciliation.total_reembolso), 0)
    ).scalar()
    total_conciliados = base.with_entities(
        func.coalesce(func.sum(Reconciliation.conciliados_count), 0)
    ).scalar()
    total_divergencias = base.with_entities(
        func.coalesce(func.sum(Reconciliation.divergencias_count), 0)
    ).scalar()
    total_faltando = base.with_entities(
        func.coalesce(func.sum(Reconciliation.only_philips_count), 0)
    ).scalar()

    recent = base.order_by(desc(Reconciliation.created_at)).limit(10).all()

    return DashboardResponse(
        total_reembolso=float(total_reembolso),
        total_conciliados=int(total_conciliados),
        total_divergencias=int(total_divergencias),
        total_faltando=int(total_faltando),
        recent=[
            ReconciliationSummary(
                id=str(r.id),
                reference_month=r.reference_month,
                philips_filename=r.philips_filename,
                stankhelp_filename=r.stankhelp_filename,
                philips_count=r.philips_count,
                stankhelp_count=r.stankhelp_count,
                conciliados_count=r.conciliados_count,
                divergencias_count=r.divergencias_count,
                only_philips_count=r.only_philips_count,
                only_stank_count=r.only_stank_count,
                total_reembolso=float(r.total_reembolso),
                total_mdo=float(r.total_mdo),
                created_at=r.created_at,
            )
            for r in recent
        ],
    )


@router.get("/monthly", response_model=list[MonthlyDataPoint])
def get_monthly_data(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Monthly aggregated data for charts."""
    rows = (
        db.query(
            Reconciliation.reference_month,
            func.sum(Reconciliation.total_reembolso).label("reembolso"),
            func.sum(Reconciliation.conciliados_count).label("conciliados"),
            func.sum(Reconciliation.divergencias_count).label("divergencias"),
        )
        .filter(Reconciliation.user_id == user.id)
        .group_by(Reconciliation.reference_month)
        .order_by(Reconciliation.reference_month)
        .all()
    )

    return [
        MonthlyDataPoint(
            month=r.reference_month,
            reembolso=float(r.reembolso or 0),
            conciliados=int(r.conciliados or 0),
            divergencias=int(r.divergencias or 0),
        )
        for r in rows
    ]


@router.get("/top-clients", response_model=list[TopClientPoint])
def get_top_divergent_clients(
    limit: int = Query(10, ge=1, le=50),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Top clients with most divergences."""
    rows = (
        db.query(
            ReconciliationRecord.cliente,
            func.count().label("divergencias"),
        )
        .join(Reconciliation)
        .filter(
            Reconciliation.user_id == user.id,
            ReconciliationRecord.status == "divergencia",
            ReconciliationRecord.cliente.isnot(None),
            ReconciliationRecord.cliente != "",
        )
        .group_by(ReconciliationRecord.cliente)
        .order_by(desc("divergencias"))
        .limit(limit)
        .all()
    )

    return [TopClientPoint(cliente=r.cliente, divergencias=r.divergencias) for r in rows]


@router.get("/by-type", response_model=list[TipoPoint])
def get_reembolso_by_type(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Reembolso aggregated by tipo de atendimento."""
    rows = (
        db.query(
            ReconciliationRecord.tipo_atendimento,
            func.coalesce(func.sum(ReconciliationRecord.reembolso_total), 0).label("valor"),
            func.count().label("count"),
        )
        .join(Reconciliation)
        .filter(
            Reconciliation.user_id == user.id,
            ReconciliationRecord.tipo_atendimento.isnot(None),
            ReconciliationRecord.tipo_atendimento != "",
        )
        .group_by(ReconciliationRecord.tipo_atendimento)
        .order_by(desc("valor"))
        .all()
    )

    return [
        TipoPoint(tipo=r.tipo_atendimento, valor=float(r.valor), count=r.count)
        for r in rows
    ]
