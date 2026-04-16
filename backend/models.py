"""SQLAlchemy models."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from database import Base


def _new_id():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=_new_id)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    reconciliations = relationship("Reconciliation", back_populates="user")


class Reconciliation(Base):
    __tablename__ = "reconciliations"

    id = Column(String(36), primary_key=True, default=_new_id)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    reference_month = Column(String(7), nullable=False)  # "2026-01"
    philips_filename = Column(String(500))
    stankhelp_filename = Column(String(500))
    philips_count = Column(Integer, default=0)
    stankhelp_count = Column(Integer, default=0)
    conciliados_count = Column(Integer, default=0)
    divergencias_count = Column(Integer, default=0)
    only_philips_count = Column(Integer, default=0)
    only_stank_count = Column(Integer, default=0)
    total_reembolso = Column(Numeric(12, 2), default=0)
    total_mdo = Column(Numeric(12, 2), default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="reconciliations")
    records = relationship(
        "ReconciliationRecord",
        back_populates="reconciliation",
        cascade="all, delete-orphan",
    )


class ReconciliationRecord(Base):
    __tablename__ = "reconciliation_records"

    id = Column(String(36), primary_key=True, default=_new_id)
    reconciliation_id = Column(
        String(36), ForeignKey("reconciliations.id", ondelete="CASCADE"), nullable=False
    )
    swo = Column(String(50), index=True)
    swo_stankhelp = Column(String(50))
    cliente = Column(String(500))
    serial = Column(String(100))
    equipamento = Column(String(500))
    tipo_atendimento = Column(String(200))
    atividade = Column(String(200))
    cidade = Column(String(200))
    data_atendimento = Column(String(20))
    distancia_km = Column(Numeric(10, 2))
    outras_despesas = Column(Numeric(10, 2))
    quilometragem = Column(Numeric(10, 2))
    hospedagem = Column(Numeric(10, 2))
    reembolso_total = Column(Numeric(10, 2))
    mdo = Column(Numeric(10, 2))
    tecnico = Column(String(200))
    contrato = Column(String(200))
    observacoes = Column(Text)
    status = Column(String(20), nullable=False, index=True)
    divergencias = Column(Text)

    reconciliation = relationship("Reconciliation", back_populates="records")
