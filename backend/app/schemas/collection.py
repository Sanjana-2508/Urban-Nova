
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, model_validator

class WasteType(str, Enum):
    GENERAL = "GENERAL"
    RECYCLABLE = "RECYCLABLE"
    ORGANIC = "ORGANIC"
    HAZARDOUS = "HAZARDOUS"
    E_WASTE = "E_WASTE"
    OTHER = "OTHER"

class CollectionStatus(str, Enum):
    SCHEDULED = "SCHEDULED"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class CollectionCreate(BaseModel):
    location: str = Field(min_length=3, max_length=255)
    waste_type: WasteType
    scheduled_date: datetime
    notes: str | None = Field(default=None, max_length=2000)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    pickup_request_id: int | None = Field(default=None, gt=0)

    @model_validator(mode='after')
    def validate_coordinate_pair(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Latitude and longitude must be provided together.")
        return self

class CollectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    collector_id: int | None
    location: str
    waste_type: WasteType
    scheduled_date: datetime
    status: CollectionStatus
    notes: str | None
    vehicle_id: int | None
    pickup_request_id: int | None
    latitude: float | None
    longitude: float | None
    is_demo: bool
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime

class CollectionAssign(BaseModel):
    collector_id: int = Field(gt=0)

class CollectionStatusUpdate(BaseModel):
    status: CollectionStatus