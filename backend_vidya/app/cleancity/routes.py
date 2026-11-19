"""CleanCity API routes. Include in the main app with:

    from app.cleancity.routes import router as cleancity_router
    app.include_router(cleancity_router)
"""

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.cleancity import service
from app.cleancity.schemas import (
    AwarenessItem,
    CleanupActionCreate,
    CleanupActionResponse,
    CleanupActionUpdate,
    HotspotResponse,
    ReportCreate,
    ReportPublic,
    ReportReview,
    ReportStaff,
)
from app.cleancity.status import ReportStatus
from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User, UserRole

router = APIRouter(
    prefix="/api/cleancity",
    tags=["CleanCity"],
)


def _require_admin(user: User, message: str) -> None:
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail=message)


@router.post("/reports", response_model=ReportPublic, status_code=status.HTTP_201_CREATED)
def submit_report(
    data: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.CITIZEN:
        raise HTTPException(
            status_code=403,
            detail="Only citizens can submit litter reports.",
        )
    return service.to_public(service.create_report(db, data, current_user.id))


# Citizens and collectors get ReportPublic items; administrators get ReportStaff items
# (extra reporter_id and internal_notes). Swagger shows the larger ReportStaff shape.
@router.get("/reports", response_model=None, responses={200: {"model": list[ReportStaff]}})
def list_reports(
    status_filter: ReportStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reports = service.list_reports(db, current_user, status_filter)
    return service.serialize_reports(db, reports, current_user)


@router.get("/reports/{report_id}", response_model=None, responses={200: {"model": ReportStaff}})
def view_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = service.get_viewable_report_or_404(db, report_id, current_user)
    return service.serialize_reports(db, [report], current_user)[0]


@router.post("/reports/{report_id}/review", response_model=ReportStaff)
def review_report(
    report_id: int,
    review_data: ReportReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user, "Only administrators can review reports.")
    report = service.review_report(db, report_id, review_data, current_user)
    return service.serialize_reports(db, [report], current_user)[0]


@router.post(
    "/reports/{report_id}/cleanup-actions",
    response_model=CleanupActionResponse,
    status_code=status.HTTP_201_CREATED,
)
def assign_cleanup_action(
    report_id: int,
    action_data: CleanupActionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user, "Only administrators can assign cleanup actions.")
    return service.assign_cleanup(db, report_id, action_data, current_user)


@router.patch("/cleanup-actions/{action_id}", response_model=CleanupActionResponse)
def resolve_cleanup_action(
    action_id: int,
    update_data: CleanupActionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.resolve_cleanup(db, action_id, update_data, current_user)


@router.post("/reports/{report_id}/photo", response_model=ReportPublic)
def upload_report_photo(
    report_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = service.get_report_or_404(db, report_id)
    if not (current_user.role == UserRole.ADMIN or report.reporter_id == current_user.id):
        raise HTTPException(status_code=404, detail="Report not found")
    data = file.file.read(service.MAX_UPLOAD_BYTES + 1)  # read one byte over the limit to detect it
    return service.to_public(service.save_photo(db, report, data, file.content_type or ""))


@router.get("/reports/{report_id}/photo")
def view_report_photo(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = service.get_viewable_report_or_404(db, report_id, current_user)
    path = service.photo_path(report)
    media_type = "image/png" if path.suffix == ".png" else "image/jpeg"
    return FileResponse(path, media_type=media_type)


@router.get("/hotspots", response_model=HotspotResponse)
def get_hotspots(
    window_days: int = Query(default=30, ge=1, le=365),
    min_reports: int = Query(default=3, ge=1, le=100),
    cell_size_deg: float = Query(default=0.005, gt=0, le=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.compute_hotspots(db, window_days, min_reports, cell_size_deg)


@router.get("/awareness", response_model=list[AwarenessItem])
def get_awareness_content(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.list_awareness(db)
