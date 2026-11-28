
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth import router as auth_router
from app.api.routes.complaint import router as complaint_router
from app.api.routes.collection import router as collection_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.user_management import router as user_management_router
from app.api.routes.vehicle import router as vehicle_router
from app.cleancity.routes import router as cleancity_router
from app.api.routes.gis_routing import router as gis_routing_router
from app.api.routes.pickup_request import router as pickup_request_router
from app.api.routes.map_location import router as map_location_router
from app.api.routes.depot import router as depot_router

app = FastAPI(
    title="Urban Nova API",
    description="Smart waste collection and CleanCity accountability platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(complaint_router)
app.include_router(pickup_request_router)
app.include_router(collection_router)
app.include_router(dashboard_router)
app.include_router(user_management_router)
app.include_router(vehicle_router)
app.include_router(cleancity_router)
app.include_router(gis_routing_router)
app.include_router(map_location_router)
app.include_router(depot_router)

@app.get("/")
def root():
    return {
        "message": "Urban Nova API is running!",
        "docs": "/docs",
    }
