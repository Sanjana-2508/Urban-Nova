
import os
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.cleancity.uploads import (
    DEFAULT_MAX_BYTES,
    UploadError,
    make_storage_key,
    validate_image,
)
from app.models import PickupRequest, User, UserRole
from app.schemas.pickup_request import (
    PickupRequestCreate,
    PickupRequestReview,
)
from app.models.collection import Collection
from app.models.vehicle import Vehicle

MAX_UPLOAD_BYTES = DEFAULT_MAX_BYTES


def evidence_upload_dir() -> Path:
    return Path(os.getenv("PICKUP_REQUEST_UPLOAD_DIR", "uploads/pickup-requests"))


def create_pickup_request(
    db: Session,
    current_user: User,
    request_data: PickupRequestCreate,
    *,
    is_demo: bool = False,
    demo_key: str | None = None,
) -> PickupRequest:
    pickup_request = PickupRequest(
        citizen_id=current_user.id,
        category=request_data.category,
        description=request_data.description,
        location=request_data.location,
        latitude=request_data.latitude,
        longitude=request_data.longitude,
        status="PENDING",
        is_demo=is_demo,
        demo_key=demo_key,
    )

    db.add(pickup_request)
    db.commit()
    db.refresh(pickup_request)

    return pickup_request


def save_pickup_evidence(
    db: Session,
    pickup_request: PickupRequest,
    data: bytes,
    content_type: str,
) -> PickupRequest:
    if pickup_request.evidence_key:
        raise HTTPException(status_code=409, detail="This pickup request already has a photo.")

    try:
        extension = validate_image(data, content_type, max_bytes=MAX_UPLOAD_BYTES)
    except UploadError as exc:
        code = 413 if exc.code == "FILE_TOO_LARGE" else 400
        raise HTTPException(status_code=code, detail=exc.message) from exc

    key = make_storage_key(extension)
    folder = evidence_upload_dir()
    folder.mkdir(parents=True, exist_ok=True)
    (folder / key).write_bytes(data)

    pickup_request.evidence_key = key
    db.commit()
    db.refresh(pickup_request)
    return pickup_request


def pickup_evidence_path(pickup_request: PickupRequest) -> Path:
    if not pickup_request.evidence_key:
        raise HTTPException(status_code=404, detail="This pickup request has no photo.")

    folder = evidence_upload_dir().resolve()
    path = (folder / pickup_request.evidence_key).resolve()
    if folder not in path.parents or not path.is_file():
        raise HTTPException(status_code=404, detail="Photo file not found.")
    return path


def get_pickup_requests(
    db: Session,
    current_user: User,
) -> list[PickupRequest]:
    statement = select(PickupRequest).order_by(
        PickupRequest.created_at.desc()
    )

    if current_user.role == UserRole.CITIZEN:
        statement = statement.where(
            PickupRequest.citizen_id == current_user.id
        )
    elif current_user.role != UserRole.ADMIN:
        return []

    return list(db.scalars(statement).all())


def get_pickup_request_by_id(
    db: Session,
    request_id: int,
    current_user: User,
) -> PickupRequest | None:
    pickup_request = db.get(PickupRequest, request_id)

    if pickup_request is None:
        return None

    if (
        current_user.role == UserRole.CITIZEN
        and pickup_request.citizen_id != current_user.id
    ):
        return None

    if current_user.role == UserRole.COLLECTOR:
        return None

    return pickup_request


def review_pickup_request(
    db: Session,
    request_id: int,
    review_data: PickupRequestReview,
) -> PickupRequest | None:
    pickup_request = db.get(PickupRequest, request_id)

    if pickup_request is None:
        return None

    if pickup_request.status != "PENDING":
        raise ValueError("Only pending requests can be reviewed.")

    pickup_request.status = review_data.status
    pickup_request.admin_note = review_data.admin_note

    db.commit()
    db.refresh(pickup_request)

    return pickup_request

def approve_and_assign_pickup_request(
    db: Session,
    request_id: int,
    vehicle_id: int,
    scheduled_date,
    notes: str | None = None,
):
    pickup_request = (
        db.query(PickupRequest)
        .filter(PickupRequest.id == request_id)
        .with_for_update()
        .first()
    )

    if pickup_request is None:
        return None

    if pickup_request.status not in ("PENDING", "APPROVED"):
        raise ValueError(
            "Only pending or approved pickup requests can be assigned."
        )

    existing_collection = (
        db.query(Collection)
        .filter(Collection.pickup_request_id == request_id)
        .first()
    )

    if existing_collection:
        raise ValueError(
            "This pickup request already has a collection."
        )

    vehicle = (
        db.query(Vehicle)
        .filter(Vehicle.id == vehicle_id)
        .with_for_update()
        .first()
    )

    if vehicle is None:
        raise ValueError("Vehicle not found.")

    if vehicle.status != "ASSIGNED":
        raise ValueError(
            "The selected vehicle must already be assigned to a Collector."
        )

    if vehicle.assigned_collector_id is None:
        raise ValueError(
            "The selected vehicle does not have an assigned Collector."
        )

    collector = db.query(User).filter(
        User.id == vehicle.assigned_collector_id
    ).first()

    if (
        collector is None
        or collector.role != UserRole.COLLECTOR
        or not collector.is_active
    ):
        raise ValueError(
            "The vehicle's assigned Collector is invalid or inactive."
        )

    category = pickup_request.category.strip().upper()
    normalized_category = category.replace("-", "_").replace(" ", "_")

    allowed_types = {
        "GENERAL",
        "RECYCLABLE",
        "ORGANIC",
        "HAZARDOUS",
        "E_WASTE",
        "OTHER",
    }

    waste_type = (
        normalized_category
        if normalized_category in allowed_types
        else "OTHER"
    )

    collection = Collection(
        location=pickup_request.location,
        latitude=pickup_request.latitude,
        longitude=pickup_request.longitude,
        waste_type=waste_type,
        scheduled_date=scheduled_date,
        notes=notes or pickup_request.description,
        pickup_request_id=pickup_request.id,
        collector_id=collector.id,
        vehicle_id=vehicle.id,
        status="ASSIGNED",
        is_demo=pickup_request.is_demo,
        demo_key=None,
    )

    try:
        db.add(collection)
        pickup_request.status = "APPROVED"

        db.flush()
        db.commit()
        db.refresh(collection)

        return collection

    except Exception:
        db.rollback()
        raise