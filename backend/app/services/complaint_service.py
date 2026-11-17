
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.complaint import Complaint
from app.schemas.complaint import ComplaintCreate
from app.schemas.complaint import ComplaintStatus

def create_complaint(
    db: Session,
    complaint_data: ComplaintCreate,
    citizen_id: int,
) -> Complaint:
    new_complaint = Complaint(
        citizen_id=citizen_id,
        category=complaint_data.category.value,
        description=complaint_data.description,
        location=complaint_data.location,
        latitude=complaint_data.latitude,
        longitude=complaint_data.longitude,
    )

    db.add(new_complaint)
    db.commit()
    db.refresh(new_complaint)

    return new_complaint


def get_citizen_complaints(
    db: Session,
    citizen_id: int,
) -> list[Complaint]:
    statement = (
        select(Complaint)
        .where(Complaint.citizen_id == citizen_id)
        .order_by(Complaint.created_at.desc())
    )

    return list(db.scalars(statement).all())


def get_complaint_by_id(
    db: Session,
    complaint_id: int,
    citizen_id: int,
) -> Complaint | None:
    statement = select(Complaint).where(
        Complaint.id == complaint_id,
        Complaint.citizen_id == citizen_id,
    )

    return db.scalars(statement).first()


def get_all_complaints(db: Session):
    return (
        db.query(Complaint)
        .order_by(Complaint.created_at.desc())
        .all()
    )



def update_complaint_status(
    db: Session,
    complaint_id: int,
    new_status: ComplaintStatus,
):
    complaint = (
        db.query(Complaint)
        .filter(Complaint.id == complaint_id)
        .first()
    )

    if not complaint:
        return None

    complaint.status = new_status.value

    db.commit()
    db.refresh(complaint)

    return complaint
