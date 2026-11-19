"""Integration tests for the CleanCity API.

These need the main backend (app.core, app.db, app.models.user) next to the CleanCity code,
so they are skipped automatically when run from backend_vidya/ on its own. They run once
the CleanCity folder has been copied into the main backend/app/. Needs: pip install httpx pytest
"""

import os

os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-cleancity-tests-0123456789")

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")
pytest.importorskip("multipart")
pytest.importorskip("app.core.dependencies")

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.cleancity import service
from app.cleancity.models import LitterReport
from app.cleancity.routes import router
from app.cleancity.seed import seed_awareness_content
from app.core.security import create_access_token
from app.db.session import Base, get_db
from app.models.user import User, UserRole

JPEG = b"\xff\xd8\xff\xe0" + b"0" * 200
REPORT = {
    "category": "OVERFLOWING_BIN",
    "description": "Bin overflowing near the bus stop",
    "latitude": 12.9716,
    "longitude": 77.5946,
}


class Api:
    """Small helper: a test client plus users with ready-made auth headers."""

    def __init__(self, client, session_factory):
        self.client = client
        self.Session = session_factory
        self._n = 0

    def user(self, role: UserRole):
        self._n += 1
        with self.Session() as db:
            u = User(name=f"{role.value} {self._n}", email=f"u{self._n}@test.com",
                     password_hash="not-a-real-hash", role=role)
            db.add(u)
            db.commit()
            db.refresh(u)
            return u.id, {"Authorization": f"Bearer {create_access_token(str(u.id))}"}

    def submit(self, headers, **changes):
        r = self.client.post("/api/cleancity/reports", json={**REPORT, **changes}, headers=headers)
        assert r.status_code == 201, r.text
        return r.json()["id"]

    def review(self, headers, report_id, decision, **extra):
        return self.client.post(
            f"/api/cleancity/reports/{report_id}/review",
            json={"decision": decision, **extra}, headers=headers,
        )

    def verify(self, admin, report_id, **extra):
        assert self.review(admin, report_id, "UNDER_REVIEW").status_code == 200
        r = self.review(admin, report_id, "VERIFIED", **extra)
        assert r.status_code == 200, r.text

    def assign(self, admin, report_id, collector_id):
        return self.client.post(
            f"/api/cleancity/reports/{report_id}/cleanup-actions",
            json={"assigned_to": collector_id, "priority": "HIGH", "due_at": "2026-12-01T09:00:00"},
            headers=admin,
        )

    def resolve(self, headers, action_id):
        return self.client.patch(
            f"/api/cleancity/cleanup-actions/{action_id}",
            json={"status": "RESOLVED", "resolution_note": "Cleared"}, headers=headers,
        )


@pytest.fixture
def api(tmp_path, monkeypatch):
    monkeypatch.setenv("CLEANCITY_UPLOAD_DIR", str(tmp_path))
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False)

    app = FastAPI()
    app.include_router(router)

    def override_get_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield Api(TestClient(app), Session)
    Base.metadata.drop_all(engine)


# ---------- submitting and viewing ----------

def test_login_is_required(api):
    assert api.client.post("/api/cleancity/reports", json=REPORT).status_code == 401
    assert api.client.get("/api/cleancity/hotspots").status_code == 401


def test_citizen_submits_and_sees_own_report(api):
    _, citizen = api.user(UserRole.CITIZEN)
    report_id = api.submit(citizen)
    body = api.client.get(f"/api/cleancity/reports/{report_id}", headers=citizen).json()
    assert body["status"] == "SUBMITTED"
    assert body["submitted_at"]  # set by the server
    assert body["evidence_url"] is None

def test_only_citizens_can_submit_reports(api):
    _, admin = api.user(UserRole.ADMIN)
    _, collector = api.user(UserRole.COLLECTOR)
    for headers in (admin, collector):
        r = api.client.post("/api/cleancity/reports", json=REPORT, headers=headers)
        assert r.status_code == 403
        assert r.json()["detail"] == "Only citizens can submit litter reports."
    # nothing was created
    assert api.client.get("/api/cleancity/reports", headers=admin).json() == []

def test_invalid_report_is_rejected(api):
    _, citizen = api.user(UserRole.CITIZEN)
    for bad in ({"latitude": 95}, {"category": "NOPE"}, {"description": ""}):
        r = api.client.post("/api/cleancity/reports", json={**REPORT, **bad}, headers=citizen)
        assert r.status_code == 422


def test_citizens_only_see_their_own_reports(api):
    _, alice = api.user(UserRole.CITIZEN)
    _, bob = api.user(UserRole.CITIZEN)
    alice_report = api.submit(alice)
    api.submit(bob)
    mine = api.client.get("/api/cleancity/reports", headers=alice).json()
    assert [r["id"] for r in mine] == [alice_report]
    assert api.client.get(f"/api/cleancity/reports/{alice_report}", headers=bob).status_code == 404


def test_citizen_view_hides_private_fields_but_admin_sees_them(api):
    _, citizen = api.user(UserRole.CITIZEN)
    _, admin = api.user(UserRole.ADMIN)
    report_id = api.submit(citizen)
    assert api.review(admin, report_id, "UNDER_REVIEW", internal_note="Seen by ward officer").status_code == 200

    public = api.client.get(f"/api/cleancity/reports/{report_id}", headers=citizen).json()
    assert "internal_notes" not in public and "reporter_id" not in public

    staff = api.client.get(f"/api/cleancity/reports/{report_id}", headers=admin).json()
    assert staff["internal_notes"] == ["Seen by ward officer"]
    assert staff["reporter_id"] is not None
    assert len(api.client.get("/api/cleancity/reports", headers=admin).json()) == 1


def test_status_filter(api):
    _, citizen = api.user(UserRole.CITIZEN)
    _, admin = api.user(UserRole.ADMIN)
    first, second = api.submit(citizen), api.submit(citizen)
    api.review(admin, first, "UNDER_REVIEW")
    r = api.client.get("/api/cleancity/reports?status=UNDER_REVIEW", headers=admin).json()
    assert [x["id"] for x in r] == [first]
    assert api.client.get("/api/cleancity/reports?status=BOGUS", headers=admin).status_code == 422


# ---------- review, assignment, resolution ----------

def test_full_report_flow(api):
    _, citizen = api.user(UserRole.CITIZEN)
    _, admin = api.user(UserRole.ADMIN)
    collector_id, collector = api.user(UserRole.COLLECTOR)

    report_id = api.submit(citizen)
    api.verify(admin, report_id, severity="HIGH", internal_note="Photo matches")

    r = api.assign(admin, report_id, collector_id)
    assert r.status_code == 201, r.text
    action_id = r.json()["id"]
    assert api.client.get(f"/api/cleancity/reports/{report_id}", headers=citizen).json()["status"] == "ASSIGNED"

    # the collector sees the report they were assigned
    assigned = api.client.get("/api/cleancity/reports", headers=collector).json()
    assert [x["id"] for x in assigned] == [report_id]

    r = api.resolve(collector, action_id)
    assert r.status_code == 200 and r.json()["status"] == "RESOLVED"
    final = api.client.get(f"/api/cleancity/reports/{report_id}", headers=citizen).json()
    assert final["status"] == "RESOLVED" and final["severity"] == "HIGH"
    assert "internal_notes" not in final


def test_only_admins_can_review_and_assign(api):
    _, citizen = api.user(UserRole.CITIZEN)
    collector_id, collector = api.user(UserRole.COLLECTOR)
    report_id = api.submit(citizen)
    assert api.review(citizen, report_id, "UNDER_REVIEW").status_code == 403
    assert api.review(collector, report_id, "UNDER_REVIEW").status_code == 403
    assert api.assign(citizen, report_id, collector_id).status_code == 403


def test_review_cannot_skip_steps(api):
    _, citizen = api.user(UserRole.CITIZEN)
    _, admin = api.user(UserRole.ADMIN)
    report_id = api.submit(citizen)
    r = api.review(admin, report_id, "VERIFIED")
    assert r.status_code == 409 and "Cannot move SUBMITTED to VERIFIED" in r.json()["detail"]


def test_reject_needs_a_reason_and_is_final(api):
    _, citizen = api.user(UserRole.CITIZEN)
    _, admin = api.user(UserRole.ADMIN)
    report_id = api.submit(citizen)
    assert api.review(admin, report_id, "REJECTED").status_code == 422
    assert api.review(admin, report_id, "REJECTED", reason="Not litter").status_code == 200
    assert api.review(admin, report_id, "UNDER_REVIEW").status_code == 409


def test_duplicate_must_point_at_another_existing_report(api):
    _, citizen = api.user(UserRole.CITIZEN)
    _, admin = api.user(UserRole.ADMIN)
    original, copy = api.submit(citizen), api.submit(citizen)
    assert api.review(admin, copy, "DUPLICATE", duplicate_of=copy).status_code == 400
    assert api.review(admin, copy, "DUPLICATE", duplicate_of=9999).status_code == 400
    assert api.review(admin, copy, "DUPLICATE", duplicate_of=original).json()["status"] == "DUPLICATE"


def test_assignment_needs_a_verified_report_and_a_collector(api):
    _, citizen = api.user(UserRole.CITIZEN)
    _, admin = api.user(UserRole.ADMIN)
    collector_id, _ = api.user(UserRole.COLLECTOR)
    other_citizen_id, _ = api.user(UserRole.CITIZEN)
    report_id = api.submit(citizen)
    assert api.assign(admin, report_id, collector_id).status_code == 409  # not verified yet
    api.verify(admin, report_id)
    assert api.assign(admin, report_id, other_citizen_id).status_code == 400  # not a collector
    assert api.assign(admin, report_id, 9999).status_code == 400
    assert api.assign(admin, report_id, collector_id).status_code == 201
    assert api.assign(admin, report_id, collector_id).status_code == 409  # already assigned


def test_collectors_can_only_resolve_their_own_actions(api):
    _, citizen = api.user(UserRole.CITIZEN)
    _, admin = api.user(UserRole.ADMIN)
    collector_id, collector = api.user(UserRole.COLLECTOR)
    _, other_collector = api.user(UserRole.COLLECTOR)
    report_id = api.submit(citizen)
    api.verify(admin, report_id)
    action_id = api.assign(admin, report_id, collector_id).json()["id"]

    assert api.resolve(other_collector, action_id).status_code == 403
    assert api.resolve(citizen, action_id).status_code == 403
    assert api.client.get(f"/api/cleancity/reports/{report_id}", headers=other_collector).status_code == 404
    assert api.resolve(collector, action_id).status_code == 200
    assert api.resolve(collector, action_id).status_code == 409  # already resolved


def test_admin_can_resolve_any_action(api):
    _, citizen = api.user(UserRole.CITIZEN)
    _, admin = api.user(UserRole.ADMIN)
    collector_id, _ = api.user(UserRole.COLLECTOR)
    report_id = api.submit(citizen)
    api.verify(admin, report_id)
    action_id = api.assign(admin, report_id, collector_id).json()["id"]
    assert api.resolve(admin, action_id).status_code == 200


# ---------- photos ----------

def test_photo_upload_and_download(api):
    _, citizen = api.user(UserRole.CITIZEN)
    _, stranger = api.user(UserRole.CITIZEN)
    _, admin = api.user(UserRole.ADMIN)
    report_id = api.submit(citizen)
    url = f"/api/cleancity/reports/{report_id}/photo"

    r = api.client.post(url, files={"file": ("my holiday.jpg", JPEG, "image/jpeg")}, headers=citizen)
    assert r.status_code == 200, r.text
    assert r.json()["evidence_url"] == url

    got = api.client.get(url, headers=citizen)
    assert got.status_code == 200 and got.content == JPEG
    assert api.client.get(url, headers=admin).status_code == 200
    assert api.client.get(url, headers=stranger).status_code == 404
    # stored under a random name, not the client's filename
    stored = [p.name for p in service.upload_dir().iterdir()]
    assert len(stored) == 1 and "holiday" not in stored[0] and stored[0].endswith(".jpg")

    again = api.client.post(url, files={"file": ("b.jpg", JPEG, "image/jpeg")}, headers=citizen)
    assert again.status_code == 409


def test_bad_uploads_are_rejected(api, monkeypatch):
    _, citizen = api.user(UserRole.CITIZEN)
    _, stranger = api.user(UserRole.CITIZEN)
    report_id = api.submit(citizen)
    url = f"/api/cleancity/reports/{report_id}/photo"

    fake = api.client.post(url, files={"file": ("x.jpg", b"<script>", "image/jpeg")}, headers=citizen)
    assert fake.status_code == 400
    gif = api.client.post(url, files={"file": ("x.gif", b"GIF89a" + b"0" * 20, "image/gif")}, headers=citizen)
    assert gif.status_code == 400
    assert api.client.post(url, files={"file": ("x.jpg", JPEG, "image/jpeg")}, headers=stranger).status_code == 404

    monkeypatch.setattr(service, "MAX_UPLOAD_BYTES", 50)
    big = api.client.post(url, files={"file": ("x.jpg", JPEG, "image/jpeg")}, headers=citizen)
    assert big.status_code == 413


# ---------- hotspots and awareness ----------

def _add_reports(api, status, points):
    with api.Session() as db:
        for lat, lon in points:
            db.add(LitterReport(reporter_id=None, category="LITTER", description="x",
                                latitude=lat, longitude=lon, status=status))
        db.commit()


def test_hotspots_use_verified_reports_only(api):
    _, citizen = api.user(UserRole.CITIZEN)
    _add_reports(api, "VERIFIED", [(12.9716, 77.5946), (12.9717, 77.5947)])
    _add_reports(api, "RESOLVED", [(12.9718, 77.5948)])            # still counts
    _add_reports(api, "SUBMITTED", [(12.9715, 77.5945)] * 5)        # does not count
    _add_reports(api, "VERIFIED", [(12.9352, 77.6245)])             # lonely cell

    body = api.client.get("/api/cleancity/hotspots", headers=citizen).json()
    assert body["method"] == "count_of_verified_reports"
    assert len(body["items"]) == 1
    hotspot = body["items"][0]
    assert hotspot["report_count"] == 3 and hotspot["recurrence"] == "NEW"

    strict = api.client.get("/api/cleancity/hotspots?min_reports=4", headers=citizen).json()
    assert strict["items"] == []
    assert api.client.get("/api/cleancity/hotspots?window_days=0", headers=citizen).status_code == 422


def test_awareness_content_is_seeded_once_and_served(api):
    _, citizen = api.user(UserRole.CITIZEN)
    assert api.client.get("/api/cleancity/awareness", headers=citizen).json() == []
    with api.Session() as db:
        assert seed_awareness_content(db) == 7
        assert seed_awareness_content(db) == 0
    items = api.client.get("/api/cleancity/awareness", headers=citizen).json()
    assert len(items) == 7 and {"id", "title", "category", "body"} <= set(items[0])
