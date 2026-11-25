
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Double, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Collection(Base):
    __tablename__ = "collections"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True,
    )

    collector_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    vehicle_id: Mapped[int | None] = mapped_column(
        ForeignKey("vehicles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    pickup_request_id: Mapped[int | None] = mapped_column(
        ForeignKey("pickup_requests.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
        index=True,
    )

    location: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    latitude: Mapped[float | None] = mapped_column(Double, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Double, nullable=True)

    waste_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    scheduled_date: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="SCHEDULED",
        server_default="SCHEDULED",
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    is_demo: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="0"
    )
    demo_key: Mapped[str | None] = mapped_column(
        String(100), nullable=True, unique=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
