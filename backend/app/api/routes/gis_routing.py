
import logging
import math
from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.route import SavedRoute
from app.models.vehicle import Vehicle
from app.models.collection import Collection

from app.services.gis_routing.route_service import create_route

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/routes",
    tags=["GIS Routing"],
)


class Stop(BaseModel):
    id: str
    name: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class RouteRequest(BaseModel):
    depot_latitude: float = Field(ge=-90, le=90)
    depot_longitude: float = Field(ge=-180, le=180)
    stops: List[Stop] = Field(min_length=1)
    vehicle_id: int | None = Field(default=None, gt=0)
    collector_id: int | None = Field(default=None, gt=0)
    collection_ids: List[int] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_unique_stop_ids(self):
        stop_ids = [stop.id for stop in self.stops]

        if len(stop_ids) != len(set(stop_ids)):
            raise ValueError(
                "Each collection point must have a unique ID."
            )

        return self


class SavedRouteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    depot_latitude: float
    depot_longitude: float
    vehicle_id: int | None
    collector_id: int | None
    collection_ids: List[int]
    ordered_stops: List[dict]
    route_geometry: List[List[float]]
    total_distance_km: float
    baseline_distance_km: float
    optimized_distance_km: float
    distance_saved_km: float
    distance_reduction_percent: float | None
    total_travel_time_min: float
    number_of_stops: int
    geometry_distance_km: float
    geometry_duration_min: float
    geometry_source: str
    source: str
    status: str
    is_demo: bool
    created_at: datetime



@router.post("/optimize")
def optimize_route(
    request: RouteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Only administrators can optimize routes.",
        )

    depot = (
        request.depot_latitude,
        request.depot_longitude,
    )

    stops = [
        stop.model_dump()
        for stop in request.stops
    ]

    try:
        return create_route(depot, stops)

    except Exception as exc:
        logger.exception("GIS route optimization failed")

        raise HTTPException(
            status_code=502,
            detail=(
                "Unable to generate the route. "
                "Please check the routing service and coordinates."
            ),
        ) from exc


class SaveRouteRequest(BaseModel):
    depot_latitude: float = Field(ge=-90, le=90)
    depot_longitude: float = Field(ge=-180, le=180)
    collection_ids: List[int] = Field(min_length=1)
    vehicle_id: int | None = Field(default=None, gt=0)
    collector_id: int | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def validate_unique_collection_ids(self):
        if len(self.collection_ids) != len(set(self.collection_ids)):
            raise ValueError("Each collection can only appear once in a route.")
        return self


@router.post("/save", response_model=SavedRouteResponse)
def save_route(
    request: SaveRouteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Only administrators can save routes.",
        )

    vehicle = None
    collector_id = request.collector_id
    if request.vehicle_id is not None:
        vehicle = db.get(Vehicle, request.vehicle_id)
        if vehicle is None:
            raise HTTPException(status_code=404, detail="Vehicle not found.")
        if vehicle.status != "ASSIGNED" or vehicle.assigned_collector_id is None:
            raise HTTPException(
                status_code=400,
                detail="The vehicle must be assigned to an active Collector before route saving.",
            )
        if collector_id is not None and collector_id != vehicle.assigned_collector_id:
            raise HTTPException(
                status_code=400,
                detail="The selected Collector must match the vehicle assignment.",
            )
        collector_id = vehicle.assigned_collector_id

    if collector_id is not None:
        collector = db.get(User, collector_id)
        if (
            collector is None
            or collector.role != UserRole.COLLECTOR
            or not collector.is_active
        ):
            raise HTTPException(
                status_code=400,
                detail="Invalid or inactive Collector.",
            )

    collections = []
    stops = []
    for collection_id in request.collection_ids:
        collection = db.get(Collection, collection_id)
        if collection is None:
            raise HTTPException(
                status_code=404,
                detail=f"Collection #{collection_id} not found.",
            )
        if collection.status in ("COMPLETED", "CANCELLED"):
            raise HTTPException(
                status_code=400,
                detail=f"Collection #{collection_id} is not available for routing.",
            )
        if (
            collection.latitude is None
            or collection.longitude is None
            or not math.isfinite(collection.latitude)
            or not math.isfinite(collection.longitude)
            or collection.latitude < -90
            or collection.latitude > 90
            or collection.longitude < -180
            or collection.longitude > 180
        ):
            raise HTTPException(
                status_code=400,
                detail=f"Collection #{collection_id} does not have valid coordinates.",
            )

        if collection.vehicle_id is not None:
            if vehicle is not None and collection.vehicle_id != vehicle.id:
                raise HTTPException(
                    status_code=400,
                    detail=f"Collection #{collection_id} is assigned to a different vehicle.",
                )
            if vehicle is None:
                vehicle = db.get(Vehicle, collection.vehicle_id)
                if vehicle is None:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Collection #{collection_id} has an invalid vehicle assignment.",
                    )
                if vehicle.status != "ASSIGNED" or vehicle.assigned_collector_id is None:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Collection #{collection_id}'s vehicle is unavailable.",
                    )
                if collector_id is None:
                    collector_id = vehicle.assigned_collector_id
                elif collector_id != vehicle.assigned_collector_id:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Collection #{collection_id} has a conflicting Collector assignment.",
                    )

        if collection.collector_id is not None:
            if collector_id is not None and collection.collector_id != collector_id:
                raise HTTPException(
                    status_code=400,
                    detail=f"Collection #{collection_id} is assigned to a different Collector.",
                )
            collector_id = collection.collector_id

        collections.append(collection)
        stops.append({
            "id": f"collection-{collection.id}",
            "name": collection.location,
            "latitude": collection.latitude,
            "longitude": collection.longitude,
        })

    if collector_id is not None:
        collector = db.get(User, collector_id)
        if (
            collector is None
            or collector.role != UserRole.COLLECTOR
            or not collector.is_active
        ):
            raise HTTPException(
                status_code=400,
                detail="Invalid or inactive Collector.",
            )

    for existing_route in db.query(SavedRoute).all():
        existing_ids = set(existing_route.collection_ids or [])
        if existing_ids.intersection(request.collection_ids):
            raise HTTPException(
                status_code=409,
                detail="One or more collections are already included in a saved route.",
            )

    depot = (
        request.depot_latitude,
        request.depot_longitude,
    )
    try:
        calculated = create_route(depot, stops)
    except Exception as exc:
        logger.exception("GIS route persistence calculation failed")
        raise HTTPException(
            status_code=502,
            detail="Unable to calculate the route from the collection coordinates.",
        ) from exc

    saved = SavedRoute(
        depot_latitude=request.depot_latitude,
        depot_longitude=request.depot_longitude,
        vehicle_id=vehicle.id if vehicle is not None else None,
        collector_id=collector_id,
        collection_ids=request.collection_ids,
        ordered_stops=calculated["ordered_stops"],
        route_geometry=calculated["route_geometry"],
        total_distance_km=calculated["total_distance_km"],
        baseline_distance_km=calculated["baseline_distance_km"],
        optimized_distance_km=calculated["optimized_distance_km"],
        distance_saved_km=calculated["distance_saved_km"],
        distance_reduction_percent=calculated["distance_reduction_percent"],
        total_travel_time_min=calculated["total_travel_time_min"],
        geometry_distance_km=calculated["geometry_distance_km"],
        geometry_duration_min=calculated["geometry_duration_min"],
        geometry_source=calculated["geometry_source"],
        source=calculated["source"],
        status="CALCULATED",
        is_demo=all(collection.is_demo for collection in collections),
    )

    db.add(saved)
    for collection in collections:
        collection.vehicle_id = vehicle.id if vehicle is not None else None
        if collector_id is not None:
            collection.collector_id = collector_id
            collection.status = "ASSIGNED"

    db.commit()
    db.refresh(saved)
    return saved


@router.get("/saved", response_model=List[SavedRouteResponse])
def list_saved_routes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.ADMIN, UserRole.COLLECTOR):
        raise HTTPException(status_code=403, detail="Not authorized to view routes.")

    statement = db.query(SavedRoute).order_by(SavedRoute.created_at.desc())
    if current_user.role == UserRole.COLLECTOR:
        statement = statement.filter(SavedRoute.collector_id == current_user.id)
    return statement.all()


@router.get("/saved/{route_id}", response_model=SavedRouteResponse)
def get_saved_route(
    route_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.ADMIN, UserRole.COLLECTOR):
        raise HTTPException(status_code=403, detail="Not authorized to view routes.")

    saved = db.get(SavedRoute, route_id)
    if saved is None:
        raise HTTPException(status_code=404, detail="Saved route not found.")
    if current_user.role == UserRole.COLLECTOR and saved.collector_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only view routes assigned to you.")
    return saved
