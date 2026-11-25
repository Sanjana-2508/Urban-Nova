import os

os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-map-location-tests")

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes.map_location import router
from app.core.dependencies import get_current_user
from app.db.session import Base, get_db
from app.models.map_location import MapLocation
from app.models.user import User, UserRole


def test_authenticated_roles_can_filter_distinct_demo_map_locations():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False)

    with session_factory() as db:
        citizen = User(
            name="Map Citizen",
            email="map-citizen@test.com",
            password_hash="test",
            role=UserRole.CITIZEN,
        )
        db.add(citizen)
        db.flush()
        db.add_all(
            [
                MapLocation(
                    location_type="COLLECTION_POINT",
                    name="Demo point",
                    description="Proposed demo service point.",
                    latitude=12.9706,
                    longitude=77.6415,
                    is_demo=True,
                    demo_key="map-point-test",
                ),
                MapLocation(
                    location_type="REPORTING_OFFICE",
                    name="Demo office",
                    description="Demo reference marker.",
                    latitude=12.9657,
                    longitude=77.5875,
                    is_demo=True,
                    demo_key="map-office-test",
                ),
            ]
        )
        db.commit()
        citizen_id = citizen.id

    app = FastAPI()
    app.include_router(router)

    def override_db():
        with session_factory() as db:
            yield db

    def override_user():
        with session_factory() as db:
            return db.get(User, citizen_id)

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = override_user

    try:
        client = TestClient(app)
        all_locations = client.get("/api/map-locations/")
        assert all_locations.status_code == 200
        assert {item["location_type"] for item in all_locations.json()} == {
            "COLLECTION_POINT",
            "REPORTING_OFFICE",
        }
        assert all(item["is_demo"] for item in all_locations.json())

        filtered = client.get(
            "/api/map-locations/",
            params={"location_type": "COLLECTION_POINT"},
        )
        assert filtered.status_code == 200
        assert [item["name"] for item in filtered.json()] == ["Demo point"]

        invalid_filter = client.get(
            "/api/map-locations/",
            params={"location_type": "HOTSPOT"},
        )
        assert invalid_filter.status_code == 422
    finally:
        Base.metadata.drop_all(engine)
