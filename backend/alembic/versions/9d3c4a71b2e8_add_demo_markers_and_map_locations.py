"""add demo markers and distinct map locations

Revision ID: 9d3c4a71b2e8
Revises: 6ab8f3e2c1d4
Create Date: 2026-12-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9d3c4a71b2e8"
down_revision: Union[str, Sequence[str], None] = "6ab8f3e2c1d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


DEMO_TABLES = (
    "pickup_requests",
    "collections",
    "vehicles",
    "litter_reports",
    "saved_routes",
)


def upgrade() -> None:
    for table_name in DEMO_TABLES:
        op.add_column(
            table_name,
            sa.Column(
                "is_demo",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
        )
        op.add_column(
            table_name,
            sa.Column("demo_key", sa.String(length=100), nullable=True),
        )
        op.create_index(
            f"uq_{table_name}_demo_key",
            table_name,
            ["demo_key"],
            unique=True,
        )

    op.create_table(
        "map_locations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("location_type", sa.String(length=30), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("latitude", sa.Double(), nullable=False),
        sa.Column("longitude", sa.Double(), nullable=False),
        sa.Column(
            "is_demo",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("demo_key", sa.String(length=100), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("demo_key", name="uq_map_locations_demo_key"),
    )
    op.create_index("ix_map_locations_id", "map_locations", ["id"], unique=False)
    op.create_index(
        "ix_map_locations_location_type",
        "map_locations",
        ["location_type"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_map_locations_location_type", table_name="map_locations")
    op.drop_index("ix_map_locations_id", table_name="map_locations")
    op.drop_table("map_locations")

    for table_name in reversed(DEMO_TABLES):
        op.drop_index(f"uq_{table_name}_demo_key", table_name=table_name)
        op.drop_column(table_name, "demo_key")
        op.drop_column(table_name, "is_demo")
