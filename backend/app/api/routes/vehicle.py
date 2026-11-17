
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.vehicle import (
    VehicleCreate,
    VehicleResponse,
    VehicleAssign,
    VehicleStatusUpdate,
)
from app.services.vehicle_service import (
    create_vehicle,
    get_all_vehicles,
    get_vehicle_by_id,
    assign_vehicle,
    update_vehicle_status,
)

router = APIRouter(
    prefix="/api/vehicles",
    tags=["Vehicle Management"],
)


def verify_admin(current_user: User):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Only administrators can manage vehicles.",
        )


@router.post(
    "/",
    response_model=VehicleResponse,
    status_code=status.HTTP_201_CREATED,
)
def admin_create_vehicle(
    vehicle_data: VehicleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_admin(current_user)

    try:
        return create_vehicle(db, vehicle_data)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Vehicle number already exists.",
        )


@router.get("/", response_model=list[VehicleResponse])
def admin_get_all_vehicles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_admin(current_user)
    return get_all_vehicles(db)


@router.get("/{vehicle_id}", response_model=VehicleResponse)
def admin_get_vehicle(
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_admin(current_user)

    vehicle = get_vehicle_by_id(db, vehicle_id)

    if not vehicle:
        raise HTTPException(
            status_code=404,
            detail="Vehicle not found.",
        )

    return vehicle


@router.patch("/{vehicle_id}/assign", response_model=VehicleResponse)
def admin_assign_vehicle(
    vehicle_id: int,
    assignment: VehicleAssign,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_admin(current_user)

    try:
        vehicle = assign_vehicle(
            db, vehicle_id, assignment.collector_id
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    if not vehicle:
        raise HTTPException(
            status_code=404,
            detail="Vehicle not found.",
        )

    return vehicle


@router.patch("/{vehicle_id}/status", response_model=VehicleResponse)
def admin_update_vehicle_status(
    vehicle_id: int,
    status_data: VehicleStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_admin(current_user)

    vehicle = update_vehicle_status(
        db, vehicle_id, status_data.status
    )

    if not vehicle:
        raise HTTPException(
            status_code=404,
            detail="Vehicle not found.",
        )

    return vehicle
