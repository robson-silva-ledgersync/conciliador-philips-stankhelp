"""Reconciliation endpoints: upload, save, list, detail, export."""

import io
import tempfile
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import desc
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_current_user
from models import Reconciliation, ReconciliationRecord, User
from reconciler import (
    ReconciliationResult,
    load_philips,
    load_stankhelp,
    normalize_swo,
    reconcile,
    write_report,
)
from schemas import (
    ReconciliationDetail,
    ReconciliationSummary,
    ReconciliationUploadResult,
    SaveReconciliationRequest,
)

router = APIRouter(prefix="/api/reconciliation", tags=["reconciliation"])


def _to_float(val) -> float:
    if val is None or val == "" or val == "None":
        return 0.0
    try:
        return float(val)
    except (ValueError, TypeError):
        return 0.0


def _result_to_upload_response(result: ReconciliationResult) -> ReconciliationUploadResult:
    """Convert ReconciliationResult dataclass to API response."""
    total_reembolso = sum(
        _to_float(r.get("Reembolso Total"))
        for r in result.conciliados + result.divergencias
    )
    total_mdo = sum(
        _to_float(r.get("MDO (R$)"))
        for r in result.conciliados + result.divergencias
    )

    def clean_record(rec: dict) -> dict:
        """Remove internal keys and convert values."""
        return {k: v for k, v in rec.items() if not k.startswith("_")}

    return ReconciliationUploadResult(
        philips_count=result.philips_count,
        stankhelp_count=result.stankhelp_count,
        conciliados_count=len(result.conciliados),
        divergencias_count=len(result.divergencias),
        only_philips_count=len(result.only_philips),
        only_stank_count=len(result.only_stank),
        total_reembolso=round(total_reembolso, 2),
        total_mdo=round(total_mdo, 2),
        conciliados=[clean_record(r) for r in result.conciliados],
        divergencias=[clean_record(r) for r in result.divergencias],
        only_philips=[clean_record(r) for r in result.only_philips],
        only_stank=[clean_record(r) for r in result.only_stank],
    )


MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = (".xlsx", ".xls")


def _validate_upload(f: UploadFile, label: str) -> None:
    if not f.filename or not f.filename.lower().endswith(ALLOWED_EXTENSIONS):
        raise HTTPException(
            status_code=400,
            detail=f"{label} deve ser um arquivo .xlsx ou .xls",
        )
    # FastAPI expoe .size em upload chunked
    if f.size is not None and f.size > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"{label} excede o limite de {MAX_UPLOAD_SIZE // 1024 // 1024} MB",
        )


@router.post("/upload", response_model=ReconciliationUploadResult)
async def upload_and_reconcile(
    philips_file: UploadFile = File(...),
    stankhelp_file: UploadFile = File(...),
    reference_month: str = Form(...),
    representante: str = Form("STANK HELP"),
    user: User = Depends(get_current_user),
):
    """Upload 2 Excel files, run reconciliation filtering by month + representante."""
    _validate_upload(philips_file, "Base Philips")
    _validate_upload(stankhelp_file, "Relatorio Stankhelp")

    if len(representante.strip()) < 3:
        raise HTTPException(
            status_code=400,
            detail="Nome do representante deve ter pelo menos 3 caracteres",
        )

    # Le com limite de tamanho (caso .size nao esteja disponivel)
    philips_bytes = await philips_file.read()
    if len(philips_bytes) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="Base Philips excede 10 MB")
    stank_bytes = await stankhelp_file.read()
    if len(stank_bytes) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="Relatorio Stankhelp excede 10 MB")

    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as f1:
        f1.write(philips_bytes)
        philips_path = f1.name

    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as f2:
        f2.write(stank_bytes)
        stankhelp_path = f2.name

    try:
        philips_data = load_philips(
            philips_path,
            representante_filter=representante,
            reference_month=reference_month,
        )
        stank_data = load_stankhelp(
            stankhelp_path,
            reference_month=reference_month,
        )
        result = reconcile(philips_data, stank_data)
        return _result_to_upload_response(result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        import os
        os.unlink(philips_path)
        os.unlink(stankhelp_path)


def _save_records(db: Session, reconciliation_id, records: list[dict], status: str):
    """Save a list of record dicts to the database."""
    for rec in records:
        db_rec = ReconciliationRecord(
            reconciliation_id=reconciliation_id,
            swo=str(rec.get("SWO", "")),
            swo_stankhelp=str(rec.get("SWO Stankhelp", "")),
            cliente=str(
                rec.get("Cliente Philips")
                or rec.get("Cliente")
                or ""
            ),
            serial=str(rec.get("Serial", "")),
            equipamento=str(
                rec.get("Equipamento Philips")
                or rec.get("Equipamento")
                or ""
            ),
            tipo_atendimento=str(
                rec.get("Tipo Atend Philips")
                or rec.get("Tipo Atendimento")
                or ""
            ),
            atividade=str(
                rec.get("Atividade Philips")
                or rec.get("Atividade")
                or ""
            ),
            cidade=str(
                rec.get("Cidade Philips")
                or rec.get("Cidade Destino")
                or ""
            ),
            data_atendimento=str(
                rec.get("Data Stankhelp")
                or rec.get("Data Atendimento")
                or ""
            ),
            distancia_km=_to_float(rec.get("Distância KM") or rec.get("Distancia KM")),
            outras_despesas=_to_float(rec.get("Outras Despesas") or rec.get("Outras Desp.")),
            quilometragem=_to_float(rec.get("Quilometragem")),
            hospedagem=_to_float(rec.get("Hospedagem")),
            reembolso_total=_to_float(rec.get("Reembolso Total")),
            mdo=_to_float(rec.get("MDO (R$)")),
            tecnico=str(rec.get("Técnico") or rec.get("Tecnico") or ""),
            contrato=str(rec.get("Contrato", "")),
            observacoes=str(rec.get("Observações") or rec.get("Observacoes") or ""),
            status=status,
            divergencias="; ".join(rec.get("_diffs", [])) if "_diffs" in rec else "",
        )
        db.add(db_rec)


@router.post("/save", response_model=ReconciliationSummary)
def save_reconciliation(
    data: SaveReconciliationRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save reconciliation result to database."""
    r = data.result

    recon = Reconciliation(
        user_id=user.id,
        reference_month=data.reference_month,
        philips_filename=data.philips_filename,
        stankhelp_filename=data.stankhelp_filename,
        philips_count=r.philips_count,
        stankhelp_count=r.stankhelp_count,
        conciliados_count=r.conciliados_count,
        divergencias_count=r.divergencias_count,
        only_philips_count=r.only_philips_count,
        only_stank_count=r.only_stank_count,
        total_reembolso=r.total_reembolso,
        total_mdo=r.total_mdo,
    )
    db.add(recon)
    db.flush()

    _save_records(db, recon.id, r.conciliados, "conciliado")
    _save_records(db, recon.id, r.divergencias, "divergencia")
    _save_records(db, recon.id, r.only_philips, "only_philips")
    _save_records(db, recon.id, r.only_stank, "only_stank")

    db.commit()
    db.refresh(recon)

    return ReconciliationSummary(
        id=str(recon.id),
        reference_month=recon.reference_month,
        philips_filename=recon.philips_filename,
        stankhelp_filename=recon.stankhelp_filename,
        philips_count=recon.philips_count,
        stankhelp_count=recon.stankhelp_count,
        conciliados_count=recon.conciliados_count,
        divergencias_count=recon.divergencias_count,
        only_philips_count=recon.only_philips_count,
        only_stank_count=recon.only_stank_count,
        total_reembolso=float(recon.total_reembolso),
        total_mdo=float(recon.total_mdo),
        created_at=recon.created_at,
    )


@router.get("/", response_model=list[ReconciliationSummary])
def list_reconciliations(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    month: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List reconciliation history (paginated)."""
    q = db.query(Reconciliation).filter(Reconciliation.user_id == user.id)
    if month:
        q = q.filter(Reconciliation.reference_month == month)
    q = q.order_by(desc(Reconciliation.created_at))
    results = q.offset(skip).limit(limit).all()

    return [
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
        for r in results
    ]


@router.get("/{reconciliation_id}", response_model=ReconciliationDetail)
def get_reconciliation(
    reconciliation_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get full detail of a reconciliation including all records."""
    recon = (
        db.query(Reconciliation)
        .filter(Reconciliation.id == reconciliation_id, Reconciliation.user_id == user.id)
        .first()
    )
    if not recon:
        raise HTTPException(status_code=404, detail="Conciliacao nao encontrada")

    return ReconciliationDetail(
        id=str(recon.id),
        reference_month=recon.reference_month,
        philips_filename=recon.philips_filename,
        stankhelp_filename=recon.stankhelp_filename,
        philips_count=recon.philips_count,
        stankhelp_count=recon.stankhelp_count,
        conciliados_count=recon.conciliados_count,
        divergencias_count=recon.divergencias_count,
        only_philips_count=recon.only_philips_count,
        only_stank_count=recon.only_stank_count,
        total_reembolso=float(recon.total_reembolso),
        total_mdo=float(recon.total_mdo),
        created_at=recon.created_at,
        records=[
            {
                "id": str(r.id),
                "swo": r.swo,
                "swo_stankhelp": r.swo_stankhelp,
                "cliente": r.cliente,
                "serial": r.serial,
                "equipamento": r.equipamento,
                "tipo_atendimento": r.tipo_atendimento,
                "atividade": r.atividade,
                "cidade": r.cidade,
                "data_atendimento": r.data_atendimento,
                "distancia_km": float(r.distancia_km) if r.distancia_km else None,
                "outras_despesas": float(r.outras_despesas) if r.outras_despesas else None,
                "quilometragem": float(r.quilometragem) if r.quilometragem else None,
                "hospedagem": float(r.hospedagem) if r.hospedagem else None,
                "reembolso_total": float(r.reembolso_total) if r.reembolso_total else None,
                "mdo": float(r.mdo) if r.mdo else None,
                "tecnico": r.tecnico,
                "contrato": r.contrato,
                "observacoes": r.observacoes,
                "status": r.status,
                "divergencias": r.divergencias,
            }
            for r in recon.records
        ],
    )


@router.get("/{reconciliation_id}/export")
def export_reconciliation(
    reconciliation_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export a saved reconciliation as Excel."""
    recon = (
        db.query(Reconciliation)
        .filter(Reconciliation.id == reconciliation_id, Reconciliation.user_id == user.id)
        .first()
    )
    if not recon:
        raise HTTPException(status_code=404, detail="Conciliacao nao encontrada")

    # Rebuild ReconciliationResult from DB records
    result = ReconciliationResult(
        philips_count=recon.philips_count,
        stankhelp_count=recon.stankhelp_count,
    )

    for rec in recon.records:
        row = {
            "SWO": rec.swo,
            "SWO Stankhelp": rec.swo_stankhelp,
            "Cliente Philips": rec.cliente,
            "Cliente Stankhelp": "",
            "Serial": rec.serial,
            "Equipamento Philips": rec.equipamento,
            "Equipamento Stankhelp": "",
            "Tipo Atend Philips": rec.tipo_atendimento,
            "Tipo Atend Stankhelp": "",
            "Data Philips": "",
            "Data Stankhelp": rec.data_atendimento,
            "Distância KM": float(rec.distancia_km) if rec.distancia_km else "",
            "Outras Despesas": float(rec.outras_despesas) if rec.outras_despesas else "",
            "Quilometragem": float(rec.quilometragem) if rec.quilometragem else "",
            "Hospedagem": float(rec.hospedagem) if rec.hospedagem else "",
            "Reembolso Total": float(rec.reembolso_total) if rec.reembolso_total else "",
            "MDO (R$)": float(rec.mdo) if rec.mdo else "",
            "Técnico": rec.tecnico,
            "Contrato": rec.contrato,
            "Observações": rec.observacoes,
            "Atividade Philips": rec.atividade,
            "Atividade Stankhelp": "",
            "Cidade Philips": rec.cidade,
            "Cidade Stankhelp": "",
            "_diff_fields": set(),
            "_diffs": rec.divergencias.split("; ") if rec.divergencias else [],
            # For only_philips / only_stank, map to expected keys
            "Cliente": rec.cliente,
            "Data Atendimento": rec.data_atendimento,
            "Cidade Destino": rec.cidade,
            "Atividade": rec.atividade,
            "Tipo Atendimento": rec.tipo_atendimento,
            "Equipamento": rec.equipamento,
            "Número de Série": rec.serial,
        }

        # Usar SWO normalizado (sem sufixo "-20") para consistencia com live reconcile.
        # Em only_stank o SWO e o original do Stankhelp ("12345-20"); em outros e o do Philips ja sem sufixo.
        normalized_swo = normalize_swo(rec.swo) if rec.swo else None

        if rec.status == "conciliado":
            result.conciliados.append(row)
            if normalized_swo:
                result.common_swos.add(normalized_swo)
        elif rec.status == "divergencia":
            result.divergencias.append(row)
            if normalized_swo:
                result.common_swos.add(normalized_swo)
        elif rec.status == "only_philips":
            result.only_philips.append(row)
            if normalized_swo:
                result.only_philips_swos.add(normalized_swo)
        elif rec.status == "only_stank":
            result.only_stank.append(row)
            if normalized_swo:
                result.only_stank_swos.add(normalized_swo)

    # Write to in-memory buffer
    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
        write_report(result, tmp.name)
        tmp.seek(0)

    import os

    with open(tmp.name, "rb") as f:
        content = f.read()
    os.unlink(tmp.name)

    filename = f"Conciliacao_{recon.reference_month}.xlsx"
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
