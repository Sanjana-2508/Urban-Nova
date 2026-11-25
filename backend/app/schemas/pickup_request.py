from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class PickupRequestCreate(BaseModel):
    category: str = Field(min_length=2, max_length=50)
    description: str | None = None
    location: str = Field(min_length=3, max_length=255)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class PickupRequestReview(BaseModel):
    status: str = Field(pattern="^(APPROVED|REJECTED)$")
    admin_note: str | None = None


class PickupRequestResponse(BaseModel):
    id: int
    citizen_id: int | None
    category: str
    description: str | None
    location: str
    latitude: float
    longitude: float
    status: str
    admin_note: str | None
    is_demo: bool
    evidence_url: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)