import os
from datetime import datetime

os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-gis-route-tests")

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.dependencies import get_current_user
from app.db.session import Base, get_db
from app.models.collection import Collection
from app.models.route import SavedRoute
from app.models.user import User, UserRole
from app.models.vehicle import Vehicle
from app.api.routes.gis_routing import router


@pytest.fixture
def api():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(engine)
    app = FastAPI()
    app.include_router(router)

    with Session() as db:
        admin = User(
            name="Route Admin",
            email="route-admin@test.com",
            password_hash="test",
            role=UserRole.ADMIN,
            is_active=True,
        )
        collector = User(
            name="Route Collector",
            email="route-collector@test.com",
            password_hash="test",
            role=UserRole.COLLECTOR,
            is_active=True,
        )
        citizen = User(
            name="Route Citizen",
            email="route-citizen@test.com",
            password_hash="test",
            role=UserRole.CITIZEN,
            is_active=True,
        )
        db.add_all([admin, collector, citizen])
        db.commit()
        db.refresh(admin)
        db.refresh(collector)
        db.refresh(citizen)
        admin_id = admin.id
        collector_id = collector.id
        citizen_id = citizen.id

        vehicle = Vehicle(
            vehicle_number="TEST-ROUTE-1",
            vehicle_type="COMPACTOR",
            capacity_kg=5000,
            status="ASSIGNED",
            assigned_collector_id=collector_id,
        )
        collection = Collection(
            location="Test stop",
            waste_type="GENERAL",
            scheduled_date=datetime(2026, 11, 25, 10, 0, 0),
            status="SCHEDULED",
            latitude=12.972,
            longitude=77.595,
        )
        db.add_all([vehicle, collection])
        db.commit()
        db.refresh(vehicle)
        db.refresh(collection)
        vehicle_id = vehicle.id
        collection_id = collection.id

    def override_db():
        with Session() as db:
            yield db

    current = {"id": admin_id}

    def override_user():
        with Session() as db:
            return db.get(User, current["id"])

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = override_user
    yield {
        "client": TestClient(app),
        "Session": Session,
        "current": current,
        "admin_id": admin_id,
        "collector_id": collector_id,
        "citizen_id": citizen_id,
        "vehicle_id": vehicle_id,
        "collection_id": collection_id,
    }
    Base.metadata.drop_all(engine)


def fake_calculated_route(depot, stops):
    return {
        "ordered_stops": stops,
        "total_distance_km": 1.25,
        "baseline_distance_km": 1.5,
        "optimized_distance_km": 1.25,
        "distance_saved_km": 0.25,
        "distance_reduction_percent": 16.67,
        "total_travel_time_min": 5.0,
        "number_of_stops": len(stops),
        "route_geometry": [list(depot), [stops[0]["latitude"], stops[0]["longitude"]], list(depot)],
        "geometry_distance_km": 1.25,
        "geometry_duration_min": 5.0,
        "geometry_source": "TEST",
        "source": "TEST",
        "status": "success",
    }


def test_save_and_retrieve_route(api, monkeypatch):
    monkeypatch.setattr(
        "app.api.routes.gis_routing.create_route",
        fake_calculated_route,
    )
    response = api["client"].post("/api/routes/save", json={
        "depot_latitude": 12.9716,
        "depot_longitude": 77.5946,
        "collection_ids": [api["collection_id"]],
        "vehicle_id": api["vehicle_id"],
        "collector_id": api["collector_id"],
    })
    assert response.status_code == 200
    body = response.json()
    assert body["vehicle_id"] == api["vehicle_id"]
    assert body["collector_id"] == api["collector_id"]
    assert body["collection_ids"] == [api["collection_id"]]
    assert body["number_of_stops"] == 1
    assert body["ordered_stops"]
    assert len(body["route_geometry"]) >= 3

    retrieved = api["client"].get(f"/api/routes/saved/{body['id']}")
    assert retrieved.status_code == 200
    assert retrieved.json()["number_of_stops"] == 1
    assert retrieved.json()["route_geometry"] == body["route_geometry"]

    duplicate = api["client"].post("/api/routes/save", json={
        "depot_latitude": 12.9716,
        "depot_longitude": 77.5946,
        "collection_ids": [api["collection_id"]],
        "vehicle_id": api["vehicle_id"],
        "collector_id": api["collector_id"],
    })
    assert duplicate.status_code == 409

    with api["Session"]() as db:
        collection = db.get(Collection, api["collection_id"])
        assert collection.vehicle_id == api["vehicle_id"]
        assert collection.collector_id == api["collector_id"]
        assert collection.status == "ASSIGNED"


def test_save_route_rejects_citizen(api):
    api["current"]["id"] = api["citizen_id"]
    response = api["client"].post("/api/routes/save", json={
        "depot_latitude": 12.9716,
        "depot_longitude": 77.5946,
        "collection_ids": [api["collection_id"]],
    })
    assert response.status_code == 403


def test_only_admins_can_optimize_routes(api):
    api["current"]["id"] = api["collector_id"]
    response = api["client"].post("/api/routes/optimize", json={
        "depot_latitude": 12.9716,
        "depot_longitude": 77.5946,
        "stops": [{
            "id": "collection-1",
            "name": "Test stop",
            "latitude": 12.972,
            "longitude": 77.595,
        }],
    })
    assert response.status_code == 403


def test_save_route_rejects_unavailable_vehicle(api, monkeypatch):
    monkeypatch.setattr(
        "app.api.routes.gis_routing.create_route",
        fake_calculated_route,
    )
    with api["Session"]() as db:
        vehicle = db.get(Vehicle, api["vehicle_id"])
        vehicle.status = "AVAILABLE"
        vehicle.assigned_collector_id = None
        db.commit()

    response = api["client"].post("/api/routes/save", json={
        "depot_latitude": 12.9716,
        "depot_longitude": 77.5946,
        "collection_ids": [api["collection_id"]],
        "vehicle_id": api["vehicle_id"],
        "collector_id": api["collector_id"],
    })
    assert response.status_code == 400
    assert "vehicle" in response.json()["detail"].lower()


def test_save_route_rejects_invalid_collection_coordinates(api, monkeypatch):
    monkeypatch.setattr(
        "app.api.routes.gis_routing.create_route",
        fake_calculated_route,
    )
    with api["Session"]() as db:
        collection = db.get(Collection, api["collection_id"])
        collection.latitude = 95
        db.commit()

    response = api["client"].post("/api/routes/save", json={
        "depot_latitude": 12.9716,
        "depot_longitude": 77.5946,
        "collection_ids": [api["collection_id"]],
        "vehicle_id": api["vehicle_id"],
        "collector_id": api["collector_id"],
    })
    assert response.status_code == 400
    assert "valid coordinates" in response.json()["detail"].lower()
