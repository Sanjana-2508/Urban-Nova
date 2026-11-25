"""Load the awareness tips from data/awareness_content.json into the database.

Safe to run more than once: it does nothing if the table already has rows.
Run from the backend folder:  python -m app.cleancity.seed
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.cleancity.awareness import load_awareness_content
from app.cleancity.models import AwarenessContent


def seed_awareness_content(db: Session) -> int:
    existing = db.scalar(select(func.count()).select_from(AwarenessContent))
    if existing:
        return 0
    items = load_awareness_content(only_active=False)
    for item in items:
        db.add(
            AwarenessContent(
                title=item["title"],
                category=item["category"],
                body=item["body"],
                active=item["active"],
            )
        )
    db.commit()
    return len(items)


if __name__ == "__main__":
    from app.db.session import SessionLocal

    with SessionLocal() as session:
        print(f"Inserted {seed_awareness_content(session)} awareness items")
