
from app.models.user import User, UserRole
from app.models.complaint import Complaint
from app.models.collection import Collection
from app.models.vehicle import Vehicle, VehicleStatus
from app.models.pickup_request import PickupRequest
from app.models.route import SavedRoute
from app.models.map_location import MapLocation
from app.models.depot_setting import DepotSetting

__all__ = [
    "User",
    "UserRole",
    "Complaint",
    "Collection",
    "Vehicle",
    "VehicleStatus",
    "PickupRequest",
    "SavedRoute",
    "MapLocation",
    "DepotSetting",
]
