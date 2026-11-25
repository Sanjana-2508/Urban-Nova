
from pydantic import BaseModel


class UserStatistics(BaseModel):
    total_users: int
    total_citizens: int
    total_collectors: int
    total_admins: int


class ComplaintStatistics(BaseModel):
    total_complaints: int
    submitted: int
    assigned: int
    in_progress: int
    resolved: int


class CollectionStatistics(BaseModel):
    total_collections: int
    scheduled: int
    assigned: int
    in_progress: int
    completed: int
    cancelled: int


class DashboardResponse(BaseModel):
    users: UserStatistics
    complaints: ComplaintStatistics
    collections: CollectionStatistics
