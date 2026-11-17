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
) -> Collection:
    new_collection = Collection(
        location=collection_data.location,
        waste_type=collection_data.waste_type.value,
        scheduled_date=collection_data.scheduled_date,
        notes=collection_data.notes,
    )

    db.add(new_collection)
    db.commit()
    db.refresh(new_collection)

    return new_collection


def get_all_collections(
    db: Session,
) -> list[Collection]:
    statement = (
        select(Collection)
        .order_by(Collection.scheduled_date.asc())
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
