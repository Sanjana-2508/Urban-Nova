"""add configurable depot settings"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9aea7dba4f15"
down_revision: Union[str, Sequence[str], None] = "a82d1f6c4e90"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "depot_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("latitude", sa.Double(), nullable=False),
        sa.Column("longitude", sa.Double(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    depot_table = sa.table(
        "depot_settings",
        sa.column("id", sa.Integer()),
        sa.column("name", sa.String()),
        sa.column("latitude", sa.Double()),
        sa.column("longitude", sa.Double()),
    )

    op.bulk_insert(
        depot_table,
        [
            {
                "id": 1,
                "name": "Urban Nova Central Collection Hub",
                "latitude": 12.9716,
                "longitude": 77.5946,
            }
        ],
    )


def downgrade() -> None:
    op.drop_table("depot_settings")