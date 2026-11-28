from datetime import datetime

from sqlalchemy import DateTime, Double, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class DepotSetting(Base):
    __tablename__ = "depot_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )
    latitude: Mapped[float] = mapped_column(Double, nullable=False)
    longitude: Mapped[float] = mapped_column(Double, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
