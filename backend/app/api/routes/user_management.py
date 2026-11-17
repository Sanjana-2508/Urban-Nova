
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.user_management import (
    UserAdminResponse,
    UserAdminUpdate,
)
from app.services.user_service import (
    get_all_users,
    get_user_by_id,
    update_user,
)

router = APIRouter(
    prefix="/api/admin/users",
    tags=["Admin User Management"],
)


def verify_admin(current_user: User):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can manage users.",
        )


@router.get("/", response_model=list[UserAdminResponse])
def admin_get_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_admin(current_user)
    return get_all_users(db)


@router.get("/{user_id}", response_model=UserAdminResponse)
def admin_get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_admin(current_user)

    user = get_user_by_id(db, user_id)

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    return user


@router.patch("/{user_id}", response_model=UserAdminResponse)
def admin_update_user(
    user_id: int,
    update_data: UserAdminUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_admin(current_user)

    user = get_user_by_id(db, user_id)

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    changes = update_data.model_dump(exclude_unset=True)

    if not changes:
        raise HTTPException(
            status_code=400,
            detail="No update information provided.",
        )

    if user_id == current_user.id and (
        changes.get("is_active") is False
        or (
            "role" in changes
            and changes["role"] != UserRole.ADMIN
        )
    ):
        raise HTTPException(
            status_code=400,
            detail="You cannot deactivate yourself or remove your own admin role.",
        )

    return update_user(db, user_id, changes)
