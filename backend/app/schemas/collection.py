
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field

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

class CollectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    collector_id: int | None
    location: str
    waste_type: WasteType
    scheduled_date: datetime
    status: CollectionStatus
    notes: str | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime

class CollectionAssign(BaseModel):
    collector_id: int = Field(gt=0)

class CollectionStatusUpdate(BaseModel):
    status: CollectionStatus