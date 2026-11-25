
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class VehicleStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    ASSIGNED = "ASSIGNED"
    MAINTENANCE = "MAINTENANCE"


class VehicleCreate(BaseModel):
    vehicle_number: str = Field(min_length=3, max_length=30)
    vehicle_type: str = Field(min_length=3, max_length=50)
    capacity_kg: float = Field(gt=0)


class VehicleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vehicle_number: str
    vehicle_type: str
    capacity_kg: float
    status: VehicleStatus
    assigned_collector_id: int | None
    is_demo: bool
    created_at: datetime
    updated_at: datetime


class VehicleAssign(BaseModel):
    collector_id: int = Field(gt=0)


class VehicleStatusUpdate(BaseModel):
    status: VehicleStatus
