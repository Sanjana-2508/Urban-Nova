
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.pickup_request import (
    PickupRequestCreate,
    PickupRequestReview,
    PickupRequestResponse,
)
from app.services.pickup_request_service import (
    create_pickup_request,
    get_pickup_requests,
    get_pickup_request_by_id,
    MAX_UPLOAD_BYTES,
    pickup_evidence_path,
    review_pickup_request,
    save_pickup_evidence,
)

router = APIRouter(
    prefix="/api/pickup-requests",
    tags=["Pickup Requests"],
)


@router.post(
    "/",
    response_model=PickupRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_pickup_request(
    request_data: PickupRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.CITIZEN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only citizens can submit pickup requests.",
        )

    return create_pickup_request(
        db=db,
        current_user=current_user,
        request_data=request_data,
    )


@router.get(
    "/",
    response_model=list[PickupRequestResponse],
)
def list_pickup_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.COLLECTOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Collectors cannot access citizen pickup requests.",
        )

    return get_pickup_requests(db, current_user)


@router.get(
    "/{request_id}",
    response_model=PickupRequestResponse,
)
def view_pickup_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pickup_request = get_pickup_request_by_id(
        db=db,
        request_id=request_id,
        current_user=current_user,
    )

    if pickup_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pickup request not found.",
        )

    return pickup_request


@router.post(
    "/{request_id}/photo",
    response_model=PickupRequestResponse,
)
def upload_pickup_photo(
    request_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pickup_request = get_pickup_request_by_id(db, request_id, current_user)
    if (
        pickup_request is None
        or current_user.role != UserRole.CITIZEN
        or pickup_request.citizen_id != current_user.id
    ):
        raise HTTPException(status_code=404, detail="Pickup request not found.")

    data = file.file.read(MAX_UPLOAD_BYTES + 1)
    return save_pickup_evidence(
        db,
        pickup_request,
        data,
        file.content_type or "",
    )


@router.get("/{request_id}/photo")
def view_pickup_photo(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pickup_request = get_pickup_request_by_id(db, request_id, current_user)
    if pickup_request is None:
        raise HTTPException(status_code=404, detail="Pickup request not found.")

    path = pickup_evidence_path(pickup_request)
    media_type = "image/png" if path.suffix == ".png" else "image/jpeg"
    return FileResponse(
        path,
        media_type=media_type,
        headers={"Cache-Control": "private, no-store"},
    )


@router.patch(
    "/{request_id}/review",
    response_model=PickupRequestResponse,
)
def admin_review_pickup_request(
    request_id: int,
    review_data: PickupRequestReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can review pickup requests.",
        )

    try:
        pickup_request = review_pickup_request(
            db=db,
            request_id=request_id,
            review_data=review_data,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    if pickup_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pickup request not found.",
        )

    return pickup_request
