from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.user import User, UserRole
from app.schemas.auth import RegisterRequest


def get_user_by_email(db: Session, email: str) -> User | None:
    statement = select(User).where(User.email == email.lower())
    return db.scalar(statement)


def create_user(db: Session, user_data: RegisterRequest) -> User:
    user = User(
        name=user_data.name.strip(),
        email=str(user_data.email).lower(),
        password_hash=hash_password(user_data.password),
        role=UserRole.CITIZEN,
        is_active=True,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


def get_all_users(db: Session):
    return (
        db.query(User)
        .order_by(User.created_at.desc())
        .all()
    )


def get_user_by_id(db: Session, user_id: int):
    return (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )


def update_user(
    db: Session,
    user_id: int,
    update_data: dict,
):
    user = get_user_by_id(db, user_id)

    if not user:
        return None

    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)

    return user
