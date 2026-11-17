
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.user import UserRole


class UserAdminResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime


class UserAdminUpdate(BaseModel):
    role: UserRole | None = None
    is_active: bool | None = None
