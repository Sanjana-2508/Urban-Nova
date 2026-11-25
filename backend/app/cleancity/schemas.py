"""Request/response shapes for the CleanCity API (see docs/cleancity-api.md)."""

from datetime import datetime, timezone
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


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
    # No timestamp field: the server sets it (UTC).


class ReportReview(BaseModel):
    decision: ReviewDecision
    reason: str | None = Field(default=None, max_length=500)
    internal_note: str | None = Field(default=None, max_length=1000)
    duplicate_of: int | None = None
    severity: Level | None = None

    @model_validator(mode="after")
    def check_required_fields(self):
        if self.decision == ReviewDecision.REJECTED and not self.reason:
            raise ValueError("reason is required when rejecting a report")
        if self.decision == ReviewDecision.DUPLICATE and self.duplicate_of is None:
            raise ValueError("duplicate_of is required when marking a duplicate")
        return self


class CleanupActionCreate(BaseModel):
    assigned_to: int  # user id of a COLLECTOR
    priority: Level
    due_at: datetime

    @field_validator("due_at")
    @classmethod
    def store_as_naive_utc(cls, v: datetime) -> datetime:
        # The database stores naive UTC datetimes, like the rest of the backend.
        if v.tzinfo is not None:
            v = v.astimezone(timezone.utc).replace(tzinfo=None)
        return v


class CleanupActionUpdate(BaseModel):
    status: Literal["RESOLVED"]
    resolution_note: str | None = Field(default=None, max_length=1000)


class ReportStatusUpdate(BaseModel):
    status: str
    at: datetime
    reason: str | None = None
    resolution_note: str | None = None


class CleanupActionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    report_id: int
    assigned_to: int | None = None
    priority: str
    status: str
    due_at: datetime
    resolved_at: datetime | None = None
    resolution_note: str | None = None


class ReportPublic(BaseModel):
    """What a citizen may see: no reporter identity, no internal notes."""

    id: int
    category: ReportCategory
    description: str
    latitude: float
    longitude: float
    status: str
    severity: Level | None = None
    is_demo: bool = False
    submitted_at: datetime
    evidence_url: str | None = None
    status_updates: list[ReportStatusUpdate] = Field(default_factory=list)


class ReportStaff(ReportPublic):
    """Staff-only extras."""

    reporter_id: int | None = None
    internal_notes: list[str] = Field(default_factory=list)
    cleanup_actions: list[CleanupActionResponse] = Field(default_factory=list)


class HotspotItem(BaseModel):
    latitude: float
    longitude: float
    report_count: int
    demo_report_count: int = 0
    last_reported_at: datetime
    recurrence: str


class HotspotResponse(BaseModel):
    method: str
    period_start: datetime
    period_end: datetime
    items: list[HotspotItem]


class AwarenessItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    category: str
    body: str
