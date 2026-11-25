from datetime import datetime

from sqlalchemy import Boolean, DateTime, Double, ForeignKey, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class SavedRoute(Base):
    __tablename__ = "saved_routes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    depot_latitude: Mapped[float] = mapped_column(Double, nullable=False)
    depot_longitude: Mapped[float] = mapped_column(Double, nullable=False)
    vehicle_id: Mapped[int | None] = mapped_column(
        ForeignKey("vehicles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    collector_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    collection_ids: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    ordered_stops: Mapped[list] = mapped_column(JSON, nullable=False)
    route_geometry: Mapped[list] = mapped_column(JSON, nullable=False)
    total_distance_km: Mapped[float] = mapped_column(nullable=False)
    baseline_distance_km: Mapped[float] = mapped_column(nullable=False)
    optimized_distance_km: Mapped[float] = mapped_column(nullable=False)
    distance_saved_km: Mapped[float] = mapped_column(nullable=False)
    distance_reduction_percent: Mapped[float | None] = mapped_column(nullable=True)
    total_travel_time_min: Mapped[float] = mapped_column(nullable=False)
    geometry_distance_km: Mapped[float] = mapped_column(nullable=False)
    geometry_duration_min: Mapped[float] = mapped_column(nullable=False)
    geometry_source: Mapped[str] = mapped_column(String(100), nullable=False)
    source: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="CALCULATED",
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

    @property
    def number_of_stops(self) -> int:
        return len(self.ordered_stops or [])
