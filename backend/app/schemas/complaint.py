
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class ComplaintCategory(str, Enum):
    MISSED_COLLECTION = "MISSED_COLLECTION"
    OVERFLOWING_BIN = "OVERFLOWING_BIN"
    ILLEGAL_DUMPING = "ILLEGAL_DUMPING"
    PUBLIC_LITTERING = "PUBLIC_LITTERING"
    OTHER = "OTHER"


class ComplaintStatus(str, Enum):
    SUBMITTED = "SUBMITTED"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"


class ComplaintCreate(BaseModel):
    category: ComplaintCategory
    description: str = Field(min_length=10, max_length=2000)
    location: str = Field(min_length=3, max_length=255)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


class ComplaintResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    citizen_id: int
    category: ComplaintCategory
    description: str
    location: str
    latitude: float | None
    longitude: float | None
    status: ComplaintStatus
    created_at: datetime
    updated_at: datetime

class ComplaintStatusUpdate(BaseModel):
    status: ComplaintStatus