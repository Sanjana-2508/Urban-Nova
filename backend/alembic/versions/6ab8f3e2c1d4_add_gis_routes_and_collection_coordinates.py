"""add GIS route persistence and collection coordinates

Revision ID: 6ab8f3e2c1d4
Revises: 3414bb35be47
Create Date: 2026-11-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "6ab8f3e2c1d4"
down_revision: Union[str, Sequence[str], None] = "3414bb35be47"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("collections", sa.Column("vehicle_id", sa.Integer(), nullable=True))
    op.add_column("collections", sa.Column("pickup_request_id", sa.Integer(), nullable=True))
    op.add_column("collections", sa.Column("latitude", sa.Double(), nullable=True))
    op.add_column("collections", sa.Column("longitude", sa.Double(), nullable=True))
    op.create_index("ix_collections_vehicle_id", "collections", ["vehicle_id"], unique=False)
    op.create_index("ix_collections_pickup_request_id", "collections", ["pickup_request_id"], unique=True)
    op.create_foreign_key(
        "fk_collections_vehicle_id",
        "collections",
        "vehicles",
        ["vehicle_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_collections_pickup_request_id",
        "collections",
        "pickup_requests",
        ["pickup_request_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "saved_routes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("depot_latitude", sa.Double(), nullable=False),
        sa.Column("depot_longitude", sa.Double(), nullable=False),
        sa.Column("vehicle_id", sa.Integer(), nullable=True),
        sa.Column("collector_id", sa.Integer(), nullable=True),
        sa.Column("collection_ids", sa.JSON(), nullable=False),
        sa.Column("ordered_stops", sa.JSON(), nullable=False),
        sa.Column("route_geometry", sa.JSON(), nullable=False),
        sa.Column("total_distance_km", sa.Float(), nullable=False),
        sa.Column("baseline_distance_km", sa.Float(), nullable=False),
        sa.Column("optimized_distance_km", sa.Float(), nullable=False),
        sa.Column("distance_saved_km", sa.Float(), nullable=False),
        sa.Column("distance_reduction_percent", sa.Float(), nullable=True),
        sa.Column("total_travel_time_min", sa.Float(), nullable=False),
        sa.Column("geometry_distance_km", sa.Float(), nullable=False),
        sa.Column("geometry_duration_min", sa.Float(), nullable=False),
        sa.Column("geometry_source", sa.String(length=100), nullable=False),
        sa.Column("source", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="CALCULATED"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["collector_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_saved_routes_id", "saved_routes", ["id"], unique=False)
    op.create_index("ix_saved_routes_vehicle_id", "saved_routes", ["vehicle_id"], unique=False)
    op.create_index("ix_saved_routes_collector_id", "saved_routes", ["collector_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_saved_routes_collector_id", table_name="saved_routes")
    op.drop_index("ix_saved_routes_vehicle_id", table_name="saved_routes")
    op.drop_index("ix_saved_routes_id", table_name="saved_routes")
    op.drop_table("saved_routes")

    op.drop_constraint("fk_collections_pickup_request_id", "collections", type_="foreignkey")
    op.drop_constraint("fk_collections_vehicle_id", "collections", type_="foreignkey")
    op.drop_index("ix_collections_pickup_request_id", table_name="collections")
    op.drop_index("ix_collections_vehicle_id", table_name="collections")
    op.drop_column("collections", "longitude")
    op.drop_column("collections", "latitude")
    op.drop_column("collections", "pickup_request_id")
    op.drop_column("collections", "vehicle_id")
