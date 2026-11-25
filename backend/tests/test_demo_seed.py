import os
import sys
from datetime import datetime, timedelta, timezone

os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-demo-seed-tests")

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.cleancity.hotspots import ReportPoint, find_hotspots
from app.cleancity.models import LitterReport
from app.db.session import Base
from app.models import Collection, MapLocation, PickupRequest, User, UserRole, Vehicle
from scripts import seed_demo_data as seed_script
from scripts.seed_demo_data import SeedPrerequisiteError, seed_demo_data


@pytest.fixture
def seed_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False)
    with session_factory() as db:
        db.add_all(
            [
                User(
                    name=f"Demo Citizen {index}",
                    email=f"demo-citizen-{index}@test.com",
                    password_hash="not-used",
                    role=UserRole.CITIZEN,
                    is_active=True,
                )
                for index in range(1, 5)
            ]
        )
        db.add(
            User(
                name="Demo Admin",
                email="demo-admin@test.com",
                password_hash="not-used",
                role=UserRole.ADMIN,
                is_active=True,
            )
        )
        db.add_all(
            [
                User(
                    name=f"Demo Collector {index}",
                    email=f"demo-collector-{index}@test.com",
                    password_hash="not-used",
                    role=UserRole.COLLECTOR,
                    is_active=True,
                )
                for index in range(1, 4)
            ]
        )
        db.commit()
        yield db
    Base.metadata.drop_all(engine)


def test_seed_is_idempotent_and_creates_real_workflow_records(seed_session):
    first_counts = seed_demo_data(seed_session)
    map_location = seed_session.scalar(
        select(MapLocation).where(
            MapLocation.demo_key == "urban-nova-blr-v1:collection-point-hebbal"
        )
    )
    map_location.latitude = 0
    map_location.longitude = 0
    old_report = seed_session.scalar(
        select(LitterReport).where(
            LitterReport.is_demo.is_(True),
            LitterReport.status == "VERIFIED",
        )
    )
    old_report.created_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(
        days=45
    )
    seed_session.commit()

    second_counts = seed_demo_data(seed_session)

    assert first_counts == second_counts
    assert first_counts["derived_hotspots"] == 3
    assert map_location.latitude == pytest.approx(13.0416620)
    assert map_location.longitude == pytest.approx(77.5899438)
    assert old_report.created_at.replace(tzinfo=timezone.utc) >= (
        datetime.now(timezone.utc) - timedelta(days=30)
    )
    assert seed_session.scalar(
        select(func.count()).select_from(MapLocation)
    ) == 9
    assert seed_session.scalar(select(func.count()).select_from(Vehicle)) == 4
    assert seed_session.scalar(
        select(func.count()).select_from(PickupRequest)
    ) == 10
    assert seed_session.scalar(select(func.count()).select_from(Collection)) == 4
    assert seed_session.scalar(
        select(func.count()).select_from(LitterReport)
    ) == 12

    assert seed_session.scalar(
        select(func.count()).select_from(PickupRequest).where(
            PickupRequest.status == "APPROVED",
            PickupRequest.is_demo.is_(True),
        )
    ) == 5
    assigned_collector_ids = {
        row[0]
        for row in seed_session.execute(
            select(Collection.collector_id).where(Collection.is_demo.is_(True))
        )
    }
    assert len(assigned_collector_ids) == 3
    assert all(
        collection.latitude is not None
        and collection.longitude is not None
        and collection.vehicle_id is not None
        and collection.status == "ASSIGNED"
        for collection in seed_session.scalars(
            select(Collection).where(Collection.is_demo.is_(True))
        )
    )

    now = datetime.now(timezone.utc)
    verified_reports = seed_session.scalars(
        select(LitterReport).where(
            LitterReport.is_demo.is_(True),
            LitterReport.status == "VERIFIED",
        )
    ).all()
    hotspots = find_hotspots(
        [
            ReportPoint(
                id=report.id,
                latitude=report.latitude,
                longitude=report.longitude,
                status=report.status,
                reported_at=report.created_at.replace(tzinfo=timezone.utc),
                is_demo=report.is_demo,
            )
            for report in verified_reports
        ],
        period_end=now,
        window_days=30,
        min_reports=3,
        cell_size_deg=0.005,
    )
    assert len(hotspots) == 3
    assert sorted(hotspot.report_count for hotspot in hotspots) == [3, 3, 3]
    assert all(
        hotspot.demo_report_count == hotspot.report_count for hotspot in hotspots
    )


def test_seed_preserves_existing_user_records(seed_session):
    citizen = seed_session.scalar(
        select(User).where(User.role == UserRole.CITIZEN).order_by(User.id)
    )
    existing_request = PickupRequest(
        citizen_id=citizen.id,
        category="GENERAL",
        description="User-created pickup request",
        location="Existing address",
        latitude=12.95,
        longitude=77.60,
        status="PENDING",
        is_demo=False,
    )
    existing_report = LitterReport(
        reporter_id=citizen.id,
        category="LITTER",
        description="User-created CleanCity report",
        latitude=12.95,
        longitude=77.60,
        status="SUBMITTED",
        is_demo=False,
    )
    seed_session.add_all([existing_request, existing_report])
    seed_session.commit()
    request_id, report_id = existing_request.id, existing_report.id

    seed_demo_data(seed_session)
    seed_demo_data(seed_session)

    preserved_request = seed_session.get(PickupRequest, request_id)
    preserved_report = seed_session.get(LitterReport, report_id)
    assert preserved_request.description == "User-created pickup request"
    assert preserved_request.status == "PENDING"
    assert not preserved_request.is_demo
    assert preserved_report.description == "User-created CleanCity report"
    assert preserved_report.status == "SUBMITTED"
    assert not preserved_report.is_demo


def test_seed_preflight_rejects_insufficient_collectors_without_writes(seed_session):
    extra_collectors = seed_session.scalars(
        select(User).where(User.role == UserRole.COLLECTOR).order_by(User.id)
    ).all()
    for collector in extra_collectors[1:]:
        seed_session.delete(collector)
    seed_session.commit()

    with pytest.raises(SeedPrerequisiteError, match="more active Collector"):
        seed_demo_data(seed_session)

    assert seed_session.scalar(
        select(func.count()).select_from(MapLocation)
    ) == 0
    assert seed_session.scalar(select(func.count()).select_from(Vehicle)) == 0
    assert seed_session.scalar(
        select(func.count()).select_from(PickupRequest)
    ) == 0


def test_seed_preflight_requires_four_active_citizens_without_writes(seed_session):
    citizens = seed_session.scalars(
        select(User).where(User.role == UserRole.CITIZEN).order_by(User.id)
    ).all()
    for citizen in citizens[1:]:
        seed_session.delete(citizen)
    seed_session.commit()

    with pytest.raises(SeedPrerequisiteError, match="active Citizen account"):
        seed_demo_data(seed_session)

    assert seed_session.scalar(
        select(func.count()).select_from(MapLocation)
    ) == 0
    assert seed_session.scalar(select(func.count()).select_from(Vehicle)) == 0


def test_seed_cli_dry_run_reports_current_targets_without_writes(
    seed_session, monkeypatch, capsys
):
    monkeypatch.setattr(seed_script, "SessionLocal", lambda: seed_session)
    monkeypatch.setattr(sys, "argv", ["seed_demo_data.py"])

    assert seed_script.main() == 0
    output = capsys.readouterr().out
    assert "Dry run: no data was written." in output
    assert "10 pickup requests" in output
    assert "4 collections" in output
    assert "12 CleanCity reports" in output
    assert seed_session.scalar(select(func.count()).select_from(MapLocation)) == 0
    assert seed_session.scalar(select(func.count()).select_from(Vehicle)) == 0
    assert seed_session.scalar(select(func.count()).select_from(PickupRequest)) == 0
    assert seed_session.scalar(select(func.count()).select_from(LitterReport)) == 0
