from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, model_validator
from typing import List

from routing.route_service import create_route


app = FastAPI(
    title="Smart Waste Collection Routing API",
    description="M3 - GIS Routing and Optimization Engine",
    version="1.0.0"
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

    @model_validator(mode="after")
    def validate_unique_stop_ids(self):
        stop_ids = [stop.id for stop in self.stops]

        if len(stop_ids) != len(set(stop_ids)):
            raise ValueError("Each collection point must have a unique ID.")

        return self


@app.get("/")
def home():
    return {
        "message": "Smart Waste Routing API is running",
        "module": "M3 - GIS Routing & Optimization"
    }


@app.post("/routes/optimize")
def optimize(request: RouteRequest):
    depot = (
        request.depot_latitude,
        request.depot_longitude
    )

    stops = [stop.model_dump() for stop in request.stops]

    try:
        return create_route(depot, stops)

    except Exception as exc:
        # Log the technical error in the terminal for debugging.
        print(f"Route optimization failed: {exc}")

        raise HTTPException(
            status_code=502,
            detail=(
                "Unable to generate the route. "
                "Please check the routing service and coordinates."
            )
        )