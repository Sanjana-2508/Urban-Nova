
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import UserRole
from app.core.dependencies import get_current_user
from app.schemas.dashboard import DashboardResponse
from app.services.dashboard_service import get_dashboard_statistics


router = APIRouter(
    prefix="/api/dashboard",
    tags=["Dashboard"],
)


@router.get("/stats", response_model=DashboardResponse)
def dashboard_stats(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can access dashboard statistics.",
        )

    return get_dashboard_statistics(db)
