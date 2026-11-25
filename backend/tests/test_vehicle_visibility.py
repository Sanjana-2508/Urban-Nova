import os

os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-vehicle-visibility")

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes.vehicle import router
from app.core.dependencies import get_current_user
from app.db.session import Base, get_db
from app.models.user import User, UserRole
from app.models.vehicle import Vehicle


def test_collectors_only_see_vehicles_assigned_to_their_account():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False)

    with session_factory() as db:
        admin = User(
            name="Fleet Admin",
            email="fleet-admin@test.com",
            password_hash="test",
            role=UserRole.ADMIN,
        )
        collector = User(
            name="Fleet Collector",
            email="fleet-collector@test.com",
            password_hash="test",
            role=UserRole.COLLECTOR,
        )
        other_collector = User(
            name="Other Collector",
            email="other-collector@test.com",
            password_hash="test",
            role=UserRole.COLLECTOR,
        )
        citizen = User(
            name="Fleet Citizen",
            email="fleet-citizen@test.com",
            password_hash="test",
            role=UserRole.CITIZEN,
        )
        db.add_all([admin, collector, other_collector, citizen])
        db.flush()
        db.add_all(
            [
                Vehicle(
                    vehicle_number="FLEET-001",
                    vehicle_type="Truck",
                    capacity_kg=1000,
                    status="ASSIGNED",
                    assigned_collector_id=collector.id,
                ),
                Vehicle(
                    vehicle_number="FLEET-002",
                    vehicle_type="Truck",
                    capacity_kg=1000,
                    status="ASSIGNED",
                    assigned_collector_id=other_collector.id,
                ),
            ]
        )
        db.commit()
        user_ids = {
            "ADMIN": admin.id,
            "COLLECTOR": collector.id,
            "CITIZEN": citizen.id,
        }

    app = FastAPI()
    app.include_router(router)
    current_role = {"value": "ADMIN"}

    def override_db():
        with session_factory() as db:
            yield db

    def override_user():
        with session_factory() as db:
            return db.get(User, user_ids[current_role["value"]])

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = override_user

    try:
        client = TestClient(app)
        admin_response = client.get("/api/vehicles/")
        assert admin_response.status_code == 200
        assert len(admin_response.json()) == 2

        current_role["value"] = "COLLECTOR"
        collector_response = client.get("/api/vehicles/")
        assert collector_response.status_code == 200
        assert [item["vehicle_number"] for item in collector_response.json()] == [
            "FLEET-001"
        ]

        current_role["value"] = "CITIZEN"
        citizen_response = client.get("/api/vehicles/")
        assert citizen_response.status_code == 403
    finally:
        Base.metadata.drop_all(engine)
