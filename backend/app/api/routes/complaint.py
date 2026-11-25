
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.complaint import ComplaintCreate, ComplaintResponse, ComplaintStatusUpdate
from app.services.complaint_service import (
    create_complaint,
    get_citizen_complaints,
    get_complaint_by_id,
    get_all_complaints,
    update_complaint_status,
)

router = APIRouter(
    prefix="/api/complaints",
    tags=["Complaints"],
)


@router.post(
    "/",
    response_model=ComplaintResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_complaint(
    complaint_data: ComplaintCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_complaint(
        db=db,
        complaint_data=complaint_data,
        citizen_id=current_user.id,
    )


@router.get(
    "/",
    response_model=list[ComplaintResponse],
)
def list_my_complaints(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_citizen_complaints(
        db=db,
        citizen_id=current_user.id,
    )


@router.get(
    "/{complaint_id}",
    response_model=ComplaintResponse,
)
def view_my_complaint(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    complaint = get_complaint_by_id(
        db=db,
        complaint_id=complaint_id,
        citizen_id=current_user.id,
    )

    if complaint is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found",
        )

    return complaint


@router.get("/admin/all", response_model=list[ComplaintResponse])
def admin_get_all_complaints(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Only administrators can view all complaints.",
        )

    return get_all_complaints(db)


@router.patch("/{complaint_id}/status", response_model=ComplaintResponse)
def admin_update_complaint_status(
    complaint_id: int,
    status_data: ComplaintStatusUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Only administrators can update complaint status.",
        )

    complaint = update_complaint_status(
        db,
        complaint_id,
        status_data.status,
    )

    if not complaint:
        raise HTTPException(
            status_code=404,
            detail="Complaint not found.",
        )

    return complaint
