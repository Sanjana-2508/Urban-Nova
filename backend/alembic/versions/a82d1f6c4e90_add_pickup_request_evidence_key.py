"""add optional pickup request photo evidence key

Revision ID: a82d1f6c4e90
Revises: 9d3c4a71b2e8
Create Date: 2026-11-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a82d1f6c4e90"
down_revision: Union[str, Sequence[str], None] = "9d3c4a71b2e8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "pickup_requests",
        sa.Column("evidence_key", sa.String(length=100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("pickup_requests", "evidence_key")
