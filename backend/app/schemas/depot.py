from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DepotUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class DepotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    latitude: float
    longitude: float
    updated_at: datetime
