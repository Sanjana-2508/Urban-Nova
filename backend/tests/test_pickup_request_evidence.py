import os

os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pickup-evidence")

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes.pickup_request import router
from app.core.security import create_access_token
from app.db.session import Base, get_db
from app.models import User, UserRole

JPEG = b"\xff\xd8\xff\xe0" + b"test-image-bytes"
REQUEST = {
    "category": "GENERAL",
    "description": "Household waste",
    "location": "Test Street, Bengaluru",
    "latitude": 12.9716,
    "longitude": 77.5946,
}


def test_pickup_photo_upload_is_authenticated_owner_scoped_and_retrievable(
    tmp_path, monkeypatch
):
    monkeypatch.setenv("PICKUP_REQUEST_UPLOAD_DIR", str(tmp_path))
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False)

    with session_factory() as db:
        citizen = User(
            name="Pickup Citizen",
            email="pickup-citizen@test.com",
            password_hash="test",
            role=UserRole.CITIZEN,
            is_active=True,
        )
        other_citizen = User(
            name="Other Citizen",
            email="other-citizen@test.com",
            password_hash="test",
            role=UserRole.CITIZEN,
            is_active=True,
        )
        admin = User(
            name="Pickup Admin",
            email="pickup-admin@test.com",
            password_hash="test",
            role=UserRole.ADMIN,
            is_active=True,
        )
        collector = User(
            name="Pickup Collector",
            email="pickup-collector@test.com",
            password_hash="test",
            role=UserRole.COLLECTOR,
            is_active=True,
        )
        db.add_all([citizen, other_citizen, admin, collector])
        db.commit()
        user_ids = {
            "citizen": citizen.id,
            "other_citizen": other_citizen.id,
            "admin": admin.id,
            "collector": collector.id,
        }

    app = FastAPI()
    app.include_router(router)
    def override_db():
        with session_factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    client = TestClient(app)
    headers = {
        role: {"Authorization": f"Bearer {create_access_token(str(user_id))}"}
        for role, user_id in user_ids.items()
    }

    try:
        assert client.post("/api/pickup-requests/", json=REQUEST).status_code == 401
        created = client.post(
            "/api/pickup-requests/",
            json=REQUEST,
            headers=headers["citizen"],
        )
        assert created.status_code == 201
        request_id = created.json()["id"]
        assert created.json()["evidence_url"] is None

        uploaded = client.post(
            f"/api/pickup-requests/{request_id}/photo",
            files={"file": ("evidence.jpg", JPEG, "image/jpeg")},
            headers=headers["citizen"],
        )
        assert uploaded.status_code == 200
        assert uploaded.json()["evidence_url"] == (
            f"/api/pickup-requests/{request_id}/photo"
        )

        photo = client.get(
            f"/api/pickup-requests/{request_id}/photo",
            headers=headers["citizen"],
        )
        assert photo.status_code == 200
        assert photo.content == JPEG
        assert photo.headers["content-type"] == "image/jpeg"
        assert photo.headers["cache-control"] == "private, no-store"
        assert len(list(tmp_path.iterdir())) == 1

        duplicate = client.post(
            f"/api/pickup-requests/{request_id}/photo",
            files={"file": ("again.jpg", JPEG, "image/jpeg")},
            headers=headers["citizen"],
        )
        assert duplicate.status_code == 409

        assert client.get(
            f"/api/pickup-requests/{request_id}/photo",
            headers=headers["other_citizen"],
        ).status_code == 404
        assert client.post(
            f"/api/pickup-requests/{request_id}/photo",
            files={"file": ("evidence.jpg", JPEG, "image/jpeg")},
            headers=headers["other_citizen"],
        ).status_code == 404

        assert client.get(
            f"/api/pickup-requests/{request_id}/photo",
            headers=headers["admin"],
        ).status_code == 200
        assert client.post(
            f"/api/pickup-requests/{request_id}/photo",
            files={"file": ("evidence.jpg", JPEG, "image/jpeg")},
            headers=headers["admin"],
        ).status_code == 404

        assert client.get(
            f"/api/pickup-requests/{request_id}/photo",
            headers=headers["collector"],
        ).status_code == 404
    finally:
        Base.metadata.drop_all(engine)


def test_pickup_photo_rejects_invalid_image_and_coordinates(tmp_path, monkeypatch):
    monkeypatch.setenv("PICKUP_REQUEST_UPLOAD_DIR", str(tmp_path))
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False)

    with session_factory() as db:
        citizen = User(
            name="Validation Citizen",
            email="validation-citizen@test.com",
            password_hash="test",
            role=UserRole.CITIZEN,
            is_active=True,
        )
        db.add(citizen)
        db.commit()
        citizen_id = citizen.id

    app = FastAPI()
    app.include_router(router)

    def override_db():
        with session_factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    client = TestClient(app)
    citizen_headers = {
        "Authorization": f"Bearer {create_access_token(str(citizen_id))}"
    }

    try:
        invalid_request = client.post(
            "/api/pickup-requests/",
            json={**REQUEST, "latitude": 91},
            headers=citizen_headers,
        )
        assert invalid_request.status_code == 422

        created = client.post(
            "/api/pickup-requests/",
            json=REQUEST,
            headers=citizen_headers,
        )
        request_id = created.json()["id"]
        invalid_image = client.post(
            f"/api/pickup-requests/{request_id}/photo",
            files={"file": ("not-image.jpg", b"not an image", "image/jpeg")},
            headers=citizen_headers,
        )
        assert invalid_image.status_code == 400

        too_large = client.post(
            f"/api/pickup-requests/{request_id}/photo",
            files={
                "file": (
                    "too-large.jpg",
                    b"\xff\xd8\xff" + b"x" * (5 * 1024 * 1024),
                    "image/jpeg",
                )
            },
            headers=citizen_headers,
        )
        assert too_large.status_code == 413
        assert not list(tmp_path.iterdir())
    finally:
        Base.metadata.drop_all(engine)
