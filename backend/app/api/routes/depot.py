from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.depot_setting import DepotSetting
from app.models.user import User, UserRole
from app.schemas.depot import DepotUpdate, DepotResponse

router = APIRouter(
    prefix="/api/depot",
    tags=["Depot Settings"],
)


@router.get("", response_model=DepotResponse)
def get_depot(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    depot = db.get(DepotSetting, 1)

    if depot is None:
        raise HTTPException(
            status_code=404,
            detail="Depot configuration has not been initialized.",
        )

    return depot


@router.put("", response_model=DepotResponse)
def update_depot(
    request: DepotUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Only administrators can update depot settings.",
        )

    depot = db.get(DepotSetting, 1)

    if depot is None:
        raise HTTPException(
            status_code=404,
            detail="Depot configuration has not been initialized.",
        )

    depot.name = request.name.strip()
    depot.latitude = request.latitude
    depot.longitude = request.longitude

    db.commit()
    db.refresh(depot)

    return depot
