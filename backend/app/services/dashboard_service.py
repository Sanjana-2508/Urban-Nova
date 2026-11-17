
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import User, UserRole, Complaint, Collection


def get_dashboard_statistics(db: Session):

    # User statistics
    total_users = db.query(func.count(User.id)).scalar() or 0

    total_citizens = db.query(func.count(User.id)).filter(
        User.role == UserRole.CITIZEN
    ).scalar() or 0

    total_collectors = db.query(func.count(User.id)).filter(
        User.role == UserRole.COLLECTOR
    ).scalar() or 0

    total_admins = db.query(func.count(User.id)).filter(
        User.role == UserRole.ADMIN
    ).scalar() or 0

    # Complaint statistics
    total_complaints = db.query(func.count(Complaint.id)).scalar() or 0

    submitted = db.query(func.count(Complaint.id)).filter(
        Complaint.status == "SUBMITTED"
    ).scalar() or 0

    assigned_complaints = db.query(func.count(Complaint.id)).filter(
        Complaint.status == "ASSIGNED"
    ).scalar() or 0

    complaints_in_progress = db.query(func.count(Complaint.id)).filter(
        Complaint.status == "IN_PROGRESS"
    ).scalar() or 0

    resolved = db.query(func.count(Complaint.id)).filter(
        Complaint.status == "RESOLVED"
    ).scalar() or 0

    # Collection statistics
    total_collections = db.query(func.count(Collection.id)).scalar() or 0

    scheduled = db.query(func.count(Collection.id)).filter(
        Collection.status == "SCHEDULED"
    ).scalar() or 0

    assigned_collections = db.query(func.count(Collection.id)).filter(
        Collection.status == "ASSIGNED"
    ).scalar() or 0

    collections_in_progress = db.query(func.count(Collection.id)).filter(
        Collection.status == "IN_PROGRESS"
    ).scalar() or 0

    completed = db.query(func.count(Collection.id)).filter(
        Collection.status == "COMPLETED"
    ).scalar() or 0

    cancelled = db.query(func.count(Collection.id)).filter(
        Collection.status == "CANCELLED"
    ).scalar() or 0

    return {
        "users": {
            "total_users": total_users,
            "total_citizens": total_citizens,
            "total_collectors": total_collectors,
            "total_admins": total_admins,
        },
        "complaints": {
            "total_complaints": total_complaints,
            "submitted": submitted,
            "assigned": assigned_complaints,
            "in_progress": complaints_in_progress,
            "resolved": resolved,
        },
        "collections": {
            "total_collections": total_collections,
            "scheduled": scheduled,
            "assigned": assigned_collections,
            "in_progress": collections_in_progress,
            "completed": completed,
            "cancelled": cancelled,
        },
    }
