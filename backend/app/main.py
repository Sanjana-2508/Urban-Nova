
from fastapi import FastAPI

from app.api.routes.auth import router as auth_router
from app.api.routes.complaint import router as complaint_router
from app.api.routes.collection import router as collection_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.user_management import router as user_management_router
from app.api.routes.vehicle import router as vehicle_router

app = FastAPI(
    title="Urban Nova API",
    description="Smart waste collection and CleanCity accountability platform",
    version="1.0.0",
)

app.include_router(auth_router)
app.include_router(complaint_router)
app.include_router(collection_router)
app.include_router(dashboard_router)
app.include_router(user_management_router)
app.include_router(vehicle_router)

@app.get("/")
def root():
    return {
        "message": "Urban Nova API is running!",
        "docs": "/docs",
    }
