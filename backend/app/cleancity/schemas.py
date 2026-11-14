"""Request/response shapes for the CleanCity API (see docs/cleancity-api.md)."""

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class ReportCategory(str, Enum):
    OVERFLOWING_BIN = "OVERFLOWING_BIN"
    ILLEGAL_DUMPING = "ILLEGAL_DUMPING"
    LITTER = "LITTER"
    OTHER = "OTHER"


class Level(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class ReviewDecision(str, Enum):
    UNDER_REVIEW = "UNDER_REVIEW"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"
    DUPLICATE = "DUPLICATE"


class ReportCreate(BaseModel):
    category: ReportCategory
    description: str = Field(min_length=1, max_length=1000)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    reported_at: datetime

    @field_validator("reported_at")
    @classmethod
    def must_have_timezone(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError("reported_at must include a timezone (use UTC, e.g. ...Z)")
        return v


class ReportReview(BaseModel):
    decision: ReviewDecision
    reason: str | None = Field(default=None, max_length=500)
    internal_note: str | None = Field(default=None, max_length=1000)
    duplicate_of: int | None = None

    @model_validator(mode="after")
    def check_required_fields(self):
        if self.decision == ReviewDecision.REJECTED and not self.reason:
            raise ValueError("reason is required when rejecting a report")
        if self.decision == ReviewDecision.DUPLICATE and self.duplicate_of is None:
            raise ValueError("duplicate_of is required when marking a duplicate")
        return self


class CleanupActionCreate(BaseModel):
    assigned_to: int | None = None
    priority: Level
    due_at: datetime


class CleanupActionUpdate(BaseModel):
    status: Literal["RESOLVED"]
    resolution_note: str | None = Field(default=None, max_length=1000)


class ReportPublic(BaseModel):
    """What a citizen may see: no reporter identity, no internal notes."""

    id: int
    category: ReportCategory
    description: str
    latitude: float
    longitude: float
    status: str
    severity: Level | None = None
    submitted_at: datetime
    evidence_url: str | None = None


class ReportStaff(ReportPublic):
    """Staff-only extras."""

    reporter_id: int | None = None
    internal_notes: list[str] = []
