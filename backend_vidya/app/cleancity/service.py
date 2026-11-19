"""CleanCity business operations. Routes call these; they talk to the database."""

import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.cleancity.hotspots import COUNTED_STATUSES, ReportPoint, find_hotspots
from app.cleancity.models import (
    AwarenessContent,
    CleanupAction,
    LitterReport,
    ReportReview,
    utc_now,
)
from app.cleancity.schemas import (
    CleanupActionCreate,
    CleanupActionUpdate,
    HotspotItem,
    HotspotResponse,
    ReportCreate,
    ReportPublic,
    ReportReview as ReportReviewData,
    ReportStaff,
)
from app.cleancity.status import InvalidTransition, ReportStatus, transition
from app.cleancity.uploads import (
    DEFAULT_MAX_BYTES,
    UploadError,
    make_storage_key,
    validate_image,
)
from app.models.user import User, UserRole

MAX_UPLOAD_BYTES = DEFAULT_MAX_BYTES
PHOTO_URL = "/api/cleancity/reports/{id}/photo"


# ---------- helpers ----------

def upload_dir() -> Path:
    """Where citizen photos are stored (outside Git). Override with CLEANCITY_UPLOAD_DIR."""
    return Path(os.getenv("CLEANCITY_UPLOAD_DIR", "uploads/cleancity"))


def _move(current: str, new: ReportStatus) -> str:
    try:
        return transition(ReportStatus(current), new).value
    except InvalidTransition as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


def get_report_or_404(db: Session, report_id: int) -> LitterReport:
    report = db.get(LitterReport, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


def can_view_report(db: Session, report: LitterReport, user: User) -> bool:
    if user.role == UserRole.ADMIN:
        return True
    if report.reporter_id == user.id:
        return True
    if user.role == UserRole.COLLECTOR:
        assigned = db.scalars(
            select(CleanupAction.id).where(
                CleanupAction.report_id == report.id,
                CleanupAction.assigned_to == user.id,
            )
        ).first()
        return assigned is not None
    return False


def get_viewable_report_or_404(db: Session, report_id: int, user: User) -> LitterReport:
    report = get_report_or_404(db, report_id)
    if not can_view_report(db, report, user):
        # Same answer as "does not exist" so IDs of other people's reports are not revealed.
        raise HTTPException(status_code=404, detail="Report not found")
    return report


# ---------- serialising ----------

def to_public(report: LitterReport) -> ReportPublic:
    return ReportPublic(
        id=report.id,
        category=report.category,
        description=report.description,
        latitude=report.latitude,
        longitude=report.longitude,
        status=report.status,
        severity=report.severity,
        submitted_at=report.created_at,
        evidence_url=PHOTO_URL.format(id=report.id) if report.evidence_key else None,
    )


def _notes_by_report(db: Session, report_ids: list[int]) -> dict[int, list[str]]:
    notes: dict[int, list[str]] = {rid: [] for rid in report_ids}
    if not report_ids:
        return notes
    rows = db.execute(
        select(ReportReview.report_id, ReportReview.internal_note)
        .where(ReportReview.report_id.in_(report_ids), ReportReview.internal_note.is_not(None))
        .order_by(ReportReview.id)
    ).all()
    for report_id, note in rows:
        notes[report_id].append(note)
    return notes


def serialize_reports(db: Session, reports: list[LitterReport], user: User):
    """Admins get the staff view (reporter id + internal notes); everyone else the public view."""
    if user.role != UserRole.ADMIN:
        return [to_public(r) for r in reports]
    notes = _notes_by_report(db, [r.id for r in reports])
    return [
        ReportStaff(
            **to_public(r).model_dump(),
            reporter_id=r.reporter_id,
            internal_notes=notes[r.id],
        )
        for r in reports
    ]


# ---------- reports ----------

def create_report(db: Session, data: ReportCreate, reporter_id: int) -> LitterReport:
    report = LitterReport(
        reporter_id=reporter_id,
        category=data.category.value,
        description=data.description,
        latitude=data.latitude,
        longitude=data.longitude,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def list_reports(db: Session, user: User, status_filter: ReportStatus | None) -> list[LitterReport]:
    statement = select(LitterReport)
    if user.role == UserRole.ADMIN:
        pass
    elif user.role == UserRole.COLLECTOR:
        statement = statement.join(
            CleanupAction, CleanupAction.report_id == LitterReport.id
        ).where(CleanupAction.assigned_to == user.id)
    else:
        statement = statement.where(LitterReport.reporter_id == user.id)
    if status_filter is not None:
        statement = statement.where(LitterReport.status == status_filter.value)
    statement = statement.order_by(LitterReport.created_at.desc(), LitterReport.id.desc())
    return list(db.scalars(statement).unique().all())


def review_report(db: Session, report_id: int, data: ReportReviewData, reviewer: User) -> LitterReport:
    report = get_report_or_404(db, report_id)
    new_status = ReportStatus(data.decision.value)
    new_value = _move(report.status, new_status)

    if new_status == ReportStatus.DUPLICATE:
        original = db.get(LitterReport, data.duplicate_of)
        if original is None or original.id == report.id:
            raise HTTPException(
                status_code=400,
                detail="duplicate_of must be the id of a different, existing report",
            )

    db.add(
        ReportReview(
            report_id=report.id,
            reviewer_id=reviewer.id,
            decision=data.decision.value,
            reason=data.reason,
            internal_note=data.internal_note,
            duplicate_of=data.duplicate_of,
        )
    )
    report.status = new_value
    if data.severity is not None:
        report.severity = data.severity.value
    db.commit()
    db.refresh(report)
    return report


# ---------- cleanup actions ----------

def assign_cleanup(db: Session, report_id: int, data: CleanupActionCreate, admin: User) -> CleanupAction:
    report = get_report_or_404(db, report_id)
    new_value = _move(report.status, ReportStatus.ASSIGNED)  # only VERIFIED reports can be assigned

    collector = db.get(User, data.assigned_to)
    if collector is None or not collector.is_active or collector.role != UserRole.COLLECTOR:
        raise HTTPException(status_code=400, detail="assigned_to must be an active collector")

    action = CleanupAction(
        report_id=report.id,
        assigned_to=collector.id,
        created_by=admin.id,
        priority=data.priority.value,
        status="ASSIGNED",
        due_at=data.due_at,
    )
    report.status = new_value
    db.add(action)
    db.commit()
    db.refresh(action)
    return action


def resolve_cleanup(db: Session, action_id: int, data: CleanupActionUpdate, user: User) -> CleanupAction:
    action = db.get(CleanupAction, action_id)
    if action is None:
        raise HTTPException(status_code=404, detail="Cleanup action not found")

    is_admin = user.role == UserRole.ADMIN
    is_assigned_collector = user.role == UserRole.COLLECTOR and action.assigned_to == user.id
    if not (is_admin or is_assigned_collector):
        raise HTTPException(
            status_code=403,
            detail="Only an administrator or the assigned collector can resolve this action",
        )
    if action.status != "ASSIGNED":
        raise HTTPException(status_code=409, detail="Cleanup action is already resolved")

    report = get_report_or_404(db, action.report_id)
    report.status = _move(report.status, ReportStatus.RESOLVED)
    action.status = "RESOLVED"
    action.resolved_at = utc_now()
    action.resolution_note = data.resolution_note
    db.commit()
    db.refresh(action)
    return action


# ---------- photos ----------

def save_photo(db: Session, report: LitterReport, data: bytes, content_type: str) -> LitterReport:
    if report.evidence_key:
        raise HTTPException(status_code=409, detail="This report already has a photo")
    try:
        extension = validate_image(data, content_type, max_bytes=MAX_UPLOAD_BYTES)
    except UploadError as exc:
        code = 413 if exc.code == "FILE_TOO_LARGE" else 400
        raise HTTPException(status_code=code, detail=exc.message)

    key = make_storage_key(extension)
    folder = upload_dir()
    folder.mkdir(parents=True, exist_ok=True)
    (folder / key).write_bytes(data)

    report.evidence_key = key
    db.commit()
    db.refresh(report)
    return report


def photo_path(report: LitterReport) -> Path:
    if not report.evidence_key:
        raise HTTPException(status_code=404, detail="This report has no photo")
    folder = upload_dir().resolve()
    path = (folder / report.evidence_key).resolve()
    if folder not in path.parents or not path.is_file():
        raise HTTPException(status_code=404, detail="Photo file not found")
    return path


# ---------- hotspots ----------

def compute_hotspots(
    db: Session, window_days: int, min_reports: int, cell_size_deg: float
) -> HotspotResponse:
    period_end = datetime.now(timezone.utc)
    window = timedelta(days=window_days)
    cutoff = (period_end - 2 * window).replace(tzinfo=None)  # current + previous window

    counted = [s.value for s in COUNTED_STATUSES]
    rows = db.scalars(
        select(LitterReport).where(
            LitterReport.status.in_(counted), LitterReport.created_at >= cutoff
        )
    ).all()
    points = [
        ReportPoint(
            id=r.id,
            latitude=r.latitude,
            longitude=r.longitude,
            status=ReportStatus(r.status),
            reported_at=r.created_at.replace(tzinfo=timezone.utc),
        )
        for r in rows
    ]
    found = find_hotspots(
        points, period_end, window_days=window_days,
        min_reports=min_reports, cell_size_deg=cell_size_deg,
    )
    return HotspotResponse(
        method="count_of_verified_reports",
        period_start=period_end - window,
        period_end=period_end,
        items=[
            HotspotItem(
                latitude=h.latitude,
                longitude=h.longitude,
                report_count=h.report_count,
                last_reported_at=h.last_reported_at,
                recurrence=h.recurrence,
            )
            for h in found
        ],
    )


# ---------- awareness ----------

def list_awareness(db: Session) -> list[AwarenessContent]:
    return list(
        db.scalars(
            select(AwarenessContent)
            .where(AwarenessContent.active.is_(True))
            .order_by(AwarenessContent.id)
        ).all()
    )
