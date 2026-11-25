from datetime import datetime

from sqlalchemy import Boolean, DateTime, Double, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class MapLocation(Base):
    __tablename__ = "map_locations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    location_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    latitude: Mapped[float] = mapped_column(Double, nullable=False)
    longitude: Mapped[float] = mapped_column(Double, nullable=False)
    is_demo: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="0"
    )
    demo_key: Mapped[str | None] = mapped_column(
        String(100), nullable=True, unique=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
