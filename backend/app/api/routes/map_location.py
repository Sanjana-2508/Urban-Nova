from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.map_location import MapLocation
from app.models.user import User
from app.schemas.map_location import MapLocationResponse, MapLocationType

router = APIRouter(
    prefix="/api/map-locations",
    tags=["Map Locations"],
)


@router.get("/", response_model=list[MapLocationResponse])
def list_map_locations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    location_type: Annotated[MapLocationType | None, Query()] = None,
):
    del current_user
    statement = select(MapLocation).order_by(
        MapLocation.location_type,
        MapLocation.name,
    )
    if location_type is not None:
        statement = statement.where(
            MapLocation.location_type == location_type.value
        )
    return list(db.scalars(statement).all())
