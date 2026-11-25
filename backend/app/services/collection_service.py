from datetime import datetime

from app.models.user import User, UserRole
from app.schemas.collection import CollectionStatus

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.collection import Collection
from app.schemas.collection import CollectionCreate


def create_collection(
    db: Session,
    collection_data: CollectionCreate,
    *,
    is_demo: bool = False,
    demo_key: str | None = None,
) -> Collection:
    from app.models.pickup_request import PickupRequest

    pickup_request = None
    latitude = collection_data.latitude
    longitude = collection_data.longitude

    if collection_data.pickup_request_id is not None:
        pickup_request = db.get(
            PickupRequest,
            collection_data.pickup_request_id,
        )
        if pickup_request is None:
            raise ValueError("Pickup request not found")
        if pickup_request.status != "APPROVED":
            raise ValueError("Only approved pickup requests can be converted")

        existing = db.query(Collection).filter(
            Collection.pickup_request_id == pickup_request.id
        ).first()
        if existing is not None:
            raise ValueError("This pickup request already has a collection")

        latitude = pickup_request.latitude
        longitude = pickup_request.longitude

    new_collection = Collection(
        location=collection_data.location,
        waste_type=collection_data.waste_type.value,
        scheduled_date=collection_data.scheduled_date,
        notes=collection_data.notes,
        latitude=latitude,
        longitude=longitude,
        pickup_request_id=(
            pickup_request.id if pickup_request is not None else None
        ),
        is_demo=is_demo,
        demo_key=demo_key,
    )

    db.add(new_collection)
    db.commit()
    db.refresh(new_collection)

    return new_collection



def get_all_collections(
    db: Session,
    current_user: User,
) -> list[Collection]:
    statement = select(Collection).order_by(
        Collection.scheduled_date.asc()
    )

    if current_user.role == UserRole.COLLECTOR:
        statement = statement.where(
            Collection.collector_id == current_user.id
        )

    return list(db.scalars(statement).all())



def get_collection_by_id(
    db: Session,
    collection_id: int,
) -> Collection | None:
    statement = select(Collection).where(
        Collection.id == collection_id
    )

    return db.scalars(statement).first()


def assign_collector(
    db: Session,
    collection_id: int,
    collector_id: int,
) -> Collection | None:
    collection = get_collection_by_id(db, collection_id)

    if collection is None:
        return None

    collector = db.get(User, collector_id)

    if (
        collector is None
        or collector.role != UserRole.COLLECTOR
        or not collector.is_active
    ):
        raise ValueError("Invalid or inactive collector")

    collection.collector_id = collector_id
    collection.status = CollectionStatus.ASSIGNED.value

    db.commit()
    db.refresh(collection)

    return collection


def update_collection_status(
    db: Session,
    collection_id: int,
    new_status: CollectionStatus,
) -> Collection | None:
    collection = get_collection_by_id(db, collection_id)

    if collection is None:
        return None

    if new_status == CollectionStatus.COMPLETED:
        collection.completed_at = datetime.now()
    else:
        collection.completed_at = None

    collection.status = new_status.value

    db.commit()
    db.refresh(collection)

    return collection
