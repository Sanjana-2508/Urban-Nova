
from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.models.vehicle import Vehicle


def create_vehicle(db: Session, vehicle_data):
    vehicle = Vehicle(
        vehicle_number=vehicle_data.vehicle_number,
        vehicle_type=vehicle_data.vehicle_type,
        capacity_kg=vehicle_data.capacity_kg,
    )

    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)

    return vehicle


def get_all_vehicles(db: Session):
    return (
        db.query(Vehicle)
        .order_by(Vehicle.created_at.desc())
        .all()
    )


def get_vehicle_by_id(db: Session, vehicle_id: int):
    return (
        db.query(Vehicle)
        .filter(Vehicle.id == vehicle_id)
        .first()
    )


def assign_vehicle(
    db: Session,
    vehicle_id: int,
    collector_id: int,
):
    vehicle = get_vehicle_by_id(db, vehicle_id)

    if not vehicle:
        return None

    if vehicle.status != "AVAILABLE":
        raise ValueError("Vehicle is not available for assignment.")

    collector = db.query(User).filter(
        User.id == collector_id
    ).first()

    if (
        not collector
        or collector.role != UserRole.COLLECTOR
        or not collector.is_active
    ):
        raise ValueError("Invalid or inactive collector.")

    vehicle.assigned_collector_id = collector_id
    vehicle.status = "ASSIGNED"

    db.commit()
    db.refresh(vehicle)

    return vehicle


def update_vehicle_status(
    db: Session,
    vehicle_id: int,
    new_status,
):
    vehicle = get_vehicle_by_id(db, vehicle_id)

    if not vehicle:
        return None

    vehicle.status = new_status.value

    if new_status.value == "AVAILABLE":
        vehicle.assigned_collector_id = None

    db.commit()
    db.refresh(vehicle)

    return vehicle
