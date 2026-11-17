
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.collection import (
    CollectionCreate,
    CollectionResponse,
    CollectionAssign,
    CollectionStatusUpdate,
    CollectionStatus,
)
from app.services.collection_service import (
    create_collection,
    get_all_collections,
    get_collection_by_id,
    assign_collector,
    update_collection_status,
)

router = APIRouter(
    prefix="/api/collections",
    tags=["Collections"],
)


@router.post(
    "/",
    response_model=CollectionResponse,
    status_code=status.HTTP_201_CREATED,
)
def schedule_collection(
    collection_data: CollectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_collection(
        db=db,
        collection_data=collection_data,
    )


@router.get(
    "/",
    response_model=list[CollectionResponse],
)
def list_collections(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_all_collections(db=db)


@router.get(
    "/{collection_id}",
    response_model=CollectionResponse,
)
def view_collection(
    collection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collection = get_collection_by_id(
        db=db,
        collection_id=collection_id,
    )

    if collection is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection not found",
        )

    return collection


@router.patch(
    "/{collection_id}/assign",
    response_model=CollectionResponse,
)
def assign_collection_to_collector(
    collection_id: int,
    assignment: CollectionAssign,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can assign collectors",
        )

    try:
        collection = assign_collector(
            db=db,
            collection_id=collection_id,
            collector_id=assignment.collector_id,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )

    if collection is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection not found",
        )

    return collection


@router.patch(
    "/{collection_id}/status",
    response_model=CollectionResponse,
)
def change_collection_status(
    collection_id: int,
    status_data: CollectionStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.ADMIN, UserRole.COLLECTOR):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to update collection status",
        )

    collection = get_collection_by_id(db, collection_id)

    if collection is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection not found",
        )

    if current_user.role == UserRole.COLLECTOR:
        if collection.collector_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update collections assigned to you",
            )

        if status_data.status not in (
            CollectionStatus.IN_PROGRESS,
            CollectionStatus.COMPLETED,
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Collectors can only mark collections as IN_PROGRESS or COMPLETED",
            )

    return update_collection_status(
        db=db,
        collection_id=collection_id,
        new_status=status_data.status,
    )
