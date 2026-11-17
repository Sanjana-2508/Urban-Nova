
from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, ForeignKey, String, Float, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class VehicleStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    ASSIGNED = "ASSIGNED"
    MAINTENANCE = "MAINTENANCE"


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    vehicle_number: Mapped[str] = mapped_column(
        String(30), unique=True, nullable=False, index=True
    )

    vehicle_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )

    capacity_kg: Mapped[float] = mapped_column(
        Float, nullable=False
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="AVAILABLE",
        server_default="AVAILABLE",
    )

    assigned_collector_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
