from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class MapLocationType(str, Enum):
    COLLECTION_POINT = "COLLECTION_POINT"
    REPORTING_OFFICE = "REPORTING_OFFICE"


class MapLocationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    location_type: MapLocationType
    name: str
    description: str | None
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    is_demo: bool
    created_at: datetime
