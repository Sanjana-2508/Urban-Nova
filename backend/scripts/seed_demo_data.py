"""Idempotently seed the approved Bengaluru local-development dataset.

Landmark coordinates were verified with OpenStreetMap Nominatim on
2026-11-25. Collection points are proposed demo service locations, not claims
that BBMP operates collection depots at those points. Attribution:
https://www.openstreetmap.org/copyright

Run from backend with --apply only after `alembic upgrade head`. The script
never creates accounts or sets passwords. Public registration creates Citizen
accounts only; an Admin must promote any needed accounts to Collector in User
Management before seeding. Do not share account passwords with this script.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import inspect, select
from sqlalchemy.orm import Session

from app.cleancity import service as cleancity_service
from app.cleancity.hotspots import ReportPoint, find_hotspots
from app.cleancity.models import LitterReport
from app.cleancity.schemas import ReportCreate, ReportReview
from app.cleancity.schemas import ReportCategory, ReviewDecision
from app.cleancity.status import ReportStatus
from app.db.session import SessionLocal
from app.models import (
    Collection,
    MapLocation,
    PickupRequest,
    User,
    UserRole,
    Vehicle,
)
from app.schemas.collection import CollectionCreate
from app.schemas.pickup_request import PickupRequestCreate, PickupRequestReview
from app.schemas.vehicle import VehicleCreate
from app.services.collection_service import assign_collector, create_collection
from app.services.pickup_request_service import (
    create_pickup_request,
    review_pickup_request,
)
from app.services.vehicle_service import assign_vehicle, create_vehicle

DEMO_PREFIX = "urban-nova-blr-v1"

MAP_LOCATIONS = [
    (
        "COLLECTION_POINT",
        "Demo collection point · Hebbal",
        "Proposed demo service location near Hebbal Flyover; not a verified municipal collection facility.",
        13.0416620,
        77.5899438,
        "collection-point-hebbal",
    ),
    (
        "COLLECTION_POINT",
        "Demo collection point · Yelahanka",
        "Proposed demo service location in Yelahanka Satellite Town; verify before operational use.",
        13.0988228,
        77.5805403,
        "collection-point-yelahanka",
    ),
    (
        "COLLECTION_POINT",
        "Demo collection point · Malleshwaram",
        "Proposed demo service location near Malleshwaram 8th Cross; not a verified municipal facility.",
        12.9998274,
        77.5713126,
        "collection-point-malleshwaram",
    ),
    (
        "COLLECTION_POINT",
        "Demo collection point · Majestic",
        "Proposed demo service location near Kempegowda Bus Station; verify before operational use.",
        12.9782170,
        77.5720167,
        "collection-point-majestic",
    ),
    (
        "COLLECTION_POINT",
        "Demo collection point · Indiranagar",
        "Proposed demo service location near Indiranagar Metro Station; not a verified municipal facility.",
        12.9783079,
        77.6386592,
        "collection-point-indiranagar",
    ),
    (
        "COLLECTION_POINT",
        "Demo collection point · Koramangala",
        "Proposed demo service location in Koramangala 5th Block; verify before operational use.",
        12.9349486,
        77.6189780,
        "collection-point-koramangala",
    ),
    (
        "COLLECTION_POINT",
        "Demo collection point · Whitefield",
        "Proposed demo service location near the Whitefield Main Road metro entrance; not a verified municipal facility.",
        12.9999105,
        77.6781981,
        "collection-point-whitefield",
    ),
    (
        "REPORTING_OFFICE",
        "Demo reporting office · JC Road",
        "Proposed reference reporting marker near the OpenStreetMap-mapped JC Road location; not verified as an operational office.",
        12.9657448,
        77.5873107,
        "reporting-office-bbmp-head",
    ),
    (
        "REPORTING_OFFICE",
        "BBMP Office · Indiranagar · demo reference",
        "OpenStreetMap-mapped BBMP Office reference in Indiranagar. Demo marker only.",
        12.9757081,
        77.6400504,
        "reporting-office-bbmp-indiranagar",
    ),
]

VEHICLES = [
    ("DEMO-BLR-001", "Compactor", 5000, "vehicle-001"),
    ("DEMO-BLR-002", "Tipper", 3500, "vehicle-002"),
    ("DEMO-BLR-003", "Electric collection truck", 2500, "vehicle-003"),
    ("DEMO-BLR-004", "Small collection truck", 1200, "vehicle-004"),
]

PICKUPS = [
    {
        "key": "pickup-01",
        "category": "ORGANIC",
        "description": "[DEMO] Household organic waste pickup near Hebbal Flyover.",
        "location": "Hebbal Flyover area, Bengaluru",
        "coordinates": (13.0410, 77.5901),
        "status": "PENDING",
    },
    {
        "key": "pickup-02",
        "category": "RECYCLABLE",
        "description": "[DEMO] Recyclables pickup near 100 Feet Road, Indiranagar.",
        "location": "100 Feet Road, Indiranagar",
        "coordinates": (12.9707, 77.6416),
        "status": "APPROVED",
    },
    {
        "key": "pickup-03",
        "category": "GENERAL",
        "description": "[DEMO] Mixed dry waste pickup in Koramangala 5th Block.",
        "location": "Koramangala 5th Block",
        "coordinates": (12.9348, 77.6190),
        "status": "APPROVED",
    },
    {
        "key": "pickup-04",
        "category": "E_WASTE",
        "description": "[DEMO] Small e-waste collection request near Malleshwaram 8th Cross.",
        "location": "Malleshwaram 8th Cross",
        "coordinates": (12.9998, 77.5713),
        "status": "APPROVED",
    },
    {
        "key": "pickup-05",
        "category": "ORGANIC",
        "description": "[DEMO] Garden and food waste pickup near Whitefield Main Road.",
        "location": "Whitefield Main Road",
        "coordinates": (12.9999, 77.6782),
        "status": "APPROVED",
    },
    {
        "key": "pickup-06",
        "category": "OTHER",
        "description": "[DEMO] Duplicate request used to demonstrate Admin rejection.",
        "location": "Jayanagar, Bengaluru",
        "coordinates": (12.9293, 77.5824),
        "status": "REJECTED",
    },
    {
        "key": "pickup-07",
        "category": "ORGANIC",
        "description": "[DEMO] Food and garden waste pickup in Yelahanka New Town.",
        "location": "Yelahanka New Town",
        "coordinates": (13.0988, 77.5805),
        "status": "PENDING",
    },
    {
        "key": "pickup-08",
        "category": "RECYCLABLE",
        "description": "[DEMO] Cardboard and recyclable pickup near Malleshwaram 8th Cross.",
        "location": "Malleshwaram 8th Cross",
        "coordinates": (12.9998, 77.5713),
        "status": "APPROVED",
    },
    {
        "key": "pickup-09",
        "category": "HAZARDOUS",
        "description": "[DEMO] Household hazardous waste request in Jayanagar.",
        "location": "Jayanagar, Bengaluru",
        "coordinates": (12.9293, 77.5824),
        "status": "REJECTED",
    },
    {
        "key": "pickup-10",
        "category": "GENERAL",
        "description": "[DEMO] Mixed household waste pickup near JC Road.",
        "location": "JC Road, Bengaluru",
        "coordinates": (12.9657, 77.5873),
        "status": "PENDING",
    },
]

COLLECTION_ASSIGNMENTS = [
    ("pickup-02", 1, 1),
    ("pickup-03", 1, 1),
    ("pickup-04", 2, 2),
    ("pickup-05", 3, 3),
]

REPORTS = [
    {
        "key": "report-01",
        "category": ReportCategory.LITTER,
        "description": "[DEMO] Litter accumulation along 100 Feet Road, Indiranagar.",
        "coordinates": (12.97064, 77.64152),
        "status": "VERIFIED",
    },
    {
        "key": "report-02",
        "category": ReportCategory.OVERFLOWING_BIN,
        "description": "[DEMO] Overflowing public bin near Indiranagar 100 Feet Road.",
        "coordinates": (12.97090, 77.64090),
        "status": "VERIFIED",
    },
    {
        "key": "report-03",
        "category": ReportCategory.ILLEGAL_DUMPING,
        "description": "[DEMO] Small debris pile near an Indiranagar side street.",
        "coordinates": (12.97120, 77.64200),
        "status": "VERIFIED",
    },
    {
        "key": "report-04",
        "category": ReportCategory.LITTER,
        "description": "[DEMO] Litter reported beside a bus stop in Indiranagar.",
        "coordinates": (12.93495, 77.61898),
        "status": "VERIFIED",
    },
    {
        "key": "report-05",
        "category": ReportCategory.OVERFLOWING_BIN,
        "description": "[DEMO] Overflowing bin in Koramangala 5th Block.",
        "coordinates": (12.93484, 77.61898),
        "status": "VERIFIED",
    },
    {
        "key": "report-06",
        "category": ReportCategory.LITTER,
        "description": "[DEMO] Street litter reported in Koramangala 5th Block.",
        "coordinates": (12.93420, 77.61950),
        "status": "VERIFIED",
    },
    {
        "key": "report-07",
        "category": ReportCategory.ILLEGAL_DUMPING,
        "description": "[DEMO] Debris reported on a Koramangala service lane.",
        "coordinates": (13.04166, 77.59010),
        "status": "VERIFIED",
    },
    {
        "key": "report-08",
        "category": ReportCategory.LITTER,
        "description": "[DEMO] Repeated litter report near Hebbal Flyover.",
        "coordinates": (13.04110, 77.59020),
        "status": "VERIFIED",
    },
    {
        "key": "report-09",
        "category": ReportCategory.OVERFLOWING_BIN,
        "description": "[DEMO] Overflowing waste bin reported near Hebbal Flyover.",
        "coordinates": (13.04180, 77.59070),
        "status": "VERIFIED",
    },
    {
        "key": "report-10",
        "category": ReportCategory.LITTER,
        "description": "[DEMO] Malleshwaram litter report under Admin review.",
        "coordinates": (12.99970, 77.57140),
        "status": "UNDER_REVIEW",
    },
    {
        "key": "report-11",
        "category": ReportCategory.ILLEGAL_DUMPING,
        "description": "[DEMO] Report rejected after review because the location was unclear.",
        "coordinates": (12.92930, 77.58240),
        "status": "REJECTED",
    },
    {
        "key": "report-12",
        "category": ReportCategory.OVERFLOWING_BIN,
        "description": "[DEMO] Overflowing bin reported near Whitefield Main Road.",
        "coordinates": (12.99991, 77.67820),
        "status": "SUBMITTED",
    },
]


class SeedPrerequisiteError(RuntimeError):
    pass


def _demo_key(key: str) -> str:
    return f"{DEMO_PREFIX}:{key}"


def _preflight(db: Session) -> tuple[list[User], User, list[User]]:
    citizens = list(
        db.scalars(
            select(User)
            .where(User.role == UserRole.CITIZEN, User.is_active.is_(True))
            .order_by(User.id)
            .limit(6)
        )
    )
    admin = db.scalar(
        select(User)
        .where(User.role == UserRole.ADMIN, User.is_active.is_(True))
        .order_by(User.id)
    )
    collectors = list(
        db.scalars(
            select(User)
            .where(User.role == UserRole.COLLECTOR, User.is_active.is_(True))
            .order_by(User.id)
            .limit(3)
        )
    )

    missing = []
    if len(citizens) < 4:
        missing.append(f"{4 - len(citizens)} more active Citizen account(s)")
    if admin is None:
        missing.append("one active Admin account")
    if len(collectors) < 3:
        missing.append(f"{3 - len(collectors)} more active Collector account(s)")
    if missing:
        raise SeedPrerequisiteError(
            "No demo records were written. Before seeding, provide "
            + ", ".join(missing)
            + " using the existing registration and Admin user-management flows."
        )
    return citizens, admin, collectors


def _ensure_pickup(
    db: Session,
    citizen: User,
    admin: User,
    data: dict,
) -> PickupRequest:
    key = _demo_key(data["key"])
    request = db.scalar(select(PickupRequest).where(PickupRequest.demo_key == key))
    if request is not None and not request.is_demo:
        raise SeedPrerequisiteError(
            f"Pickup {data['key']} uses the demo key but is not marked as demo."
        )
    if request is None:
        latitude, longitude = data["coordinates"]
        request = create_pickup_request(
            db,
            citizen,
            PickupRequestCreate(
                category=data["category"],
                description=data["description"],
                location=data["location"],
                latitude=latitude,
                longitude=longitude,
            ),
            is_demo=True,
            demo_key=key,
        )

    desired = data["status"]
    if request.status == "PENDING" and desired != "PENDING":
        request = review_pickup_request(
            db,
            request.id,
            PickupRequestReview(
                status=desired,
                admin_note=f"{DEMO_PREFIX} seeded review state",
            ),
        )
    elif request.status != desired:
        raise SeedPrerequisiteError(
            f"Demo pickup {data['key']} already exists in state {request.status}; "
            "it was not overwritten."
        )
    return request


def _ensure_report(
    db: Session,
    reporter: User,
    admin: User,
    data: dict,
) -> LitterReport:
    key = _demo_key(data["key"])
    report = db.scalar(select(LitterReport).where(LitterReport.demo_key == key))
    if report is None:
        latitude, longitude = data["coordinates"]
        report = cleancity_service.create_report(
            db,
            ReportCreate(
                category=data["category"],
                description=data["description"],
                latitude=latitude,
                longitude=longitude,
            ),
            reporter.id,
            is_demo=True,
            demo_key=key,
        )
    else:
        allowed_existing_states = {
            "SUBMITTED": {ReportStatus.SUBMITTED.value},
            "VERIFIED": {
                ReportStatus.SUBMITTED.value,
                ReportStatus.UNDER_REVIEW.value,
                ReportStatus.VERIFIED.value,
            },
            "UNDER_REVIEW": {
                ReportStatus.SUBMITTED.value,
                ReportStatus.UNDER_REVIEW.value,
            },
            "REJECTED": {
                ReportStatus.SUBMITTED.value,
                ReportStatus.UNDER_REVIEW.value,
                ReportStatus.REJECTED.value,
            },
        }
        if report.status not in allowed_existing_states[data["status"]]:
            raise SeedPrerequisiteError(
                f"Demo CleanCity report {data['key']} is {report.status}; "
                "it was not overwritten."
            )
        if not report.is_demo:
            raise SeedPrerequisiteError(
                f"CleanCity report {data['key']} uses the demo key but is not marked as demo."
            )
        latitude, longitude = data["coordinates"]
        desired_values = (
            data["category"].value,
            data["description"],
            latitude,
            longitude,
        )
        current_values = (
            report.category,
            report.description,
            report.latitude,
            report.longitude,
        )
        if current_values != desired_values:
            report.category, report.description, report.latitude, report.longitude = desired_values
            db.commit()
            db.refresh(report)

    desired = data["status"]
    if desired == "VERIFIED":
        if report.status == ReportStatus.SUBMITTED.value:
            cleancity_service.review_report(
                db,
                report.id,
                ReportReview(decision=ReviewDecision.UNDER_REVIEW),
                admin,
            )
        if report.status == ReportStatus.SUBMITTED.value or report.status == ReportStatus.UNDER_REVIEW.value:
            report = cleancity_service.review_report(
                db,
                report.id,
                ReportReview(decision=ReviewDecision.VERIFIED),
                admin,
            )
    elif desired == "UNDER_REVIEW" and report.status == ReportStatus.SUBMITTED.value:
        report = cleancity_service.review_report(
            db,
            report.id,
            ReportReview(decision=ReviewDecision.UNDER_REVIEW),
            admin,
        )
    elif desired == "REJECTED":
        if report.status == ReportStatus.SUBMITTED.value:
            cleancity_service.review_report(
                db,
                report.id,
                ReportReview(decision=ReviewDecision.UNDER_REVIEW),
                admin,
            )
        if report.status == ReportStatus.UNDER_REVIEW.value:
            report = cleancity_service.review_report(
                db,
                report.id,
                ReportReview(
                    decision=ReviewDecision.REJECTED,
                    reason="Demo rejection: the reported location is not sufficiently specific.",
                ),
                admin,
            )

    if report.status != desired:
        raise SeedPrerequisiteError(
            f"Demo CleanCity report {data['key']} is {report.status}; "
            "it was not overwritten."
        )
    now = datetime.now(timezone.utc)
    reported_at = report.created_at
    if reported_at.tzinfo is None:
        reported_at = reported_at.replace(tzinfo=timezone.utc)
    else:
        reported_at = reported_at.astimezone(timezone.utc)
    if reported_at < now - timedelta(days=30) or reported_at > now:
        report.created_at = now.replace(tzinfo=None)
        db.commit()
        db.refresh(report)
    return report


def _count_demo_hotspots(db: Session) -> int:
    reports = db.scalars(
        select(LitterReport).where(
            LitterReport.demo_key.like(f"{DEMO_PREFIX}:%"),
            LitterReport.is_demo.is_(True),
            LitterReport.status == ReportStatus.VERIFIED.value,
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
                is_demo=True,
            )
            for report in reports
        ],
        period_end=datetime.now(timezone.utc),
        window_days=30,
        min_reports=3,
        cell_size_deg=0.005,
    )
    if not 3 <= len(hotspots) <= 5:
        raise SeedPrerequisiteError(
            "The verified demo reports do not currently produce 3-5 hotspots "
            "with the configured 30-day clustering algorithm."
        )
    return len(hotspots)


def seed_demo_data(db: Session) -> dict[str, int]:
    citizens, admin, collectors = _preflight(db)
    collector_by_index = {index + 1: collector for index, collector in enumerate(collectors)}

    for location_type, name, description, latitude, longitude, key in MAP_LOCATIONS:
        existing = db.scalar(
            select(MapLocation).where(MapLocation.demo_key == _demo_key(key))
        )
        if existing is None:
            db.add(
                MapLocation(
                    location_type=location_type,
                    name=name,
                    description=description,
                    latitude=latitude,
                    longitude=longitude,
                    is_demo=True,
                    demo_key=_demo_key(key),
                )
            )
        elif not existing.is_demo:
            raise SeedPrerequisiteError(
                f"Map location {key} uses the demo key but is not marked as demo."
            )
        else:
            existing.location_type = location_type
            existing.name = name
            existing.description = description
            existing.latitude = latitude
            existing.longitude = longitude
    db.commit()

    demo_vehicles = []
    for number, vehicle_type, capacity, key in VEHICLES:
        vehicle = db.scalar(select(Vehicle).where(Vehicle.demo_key == _demo_key(key)))
        if vehicle is None:
            vehicle = create_vehicle(
                db,
                VehicleCreate(
                    vehicle_number=number,
                    vehicle_type=vehicle_type,
                    capacity_kg=capacity,
                ),
                is_demo=True,
                demo_key=_demo_key(key),
            )
            collector_index = len(demo_vehicles) + 1
            if collector_index <= 3:
                assign_vehicle(db, vehicle.id, collector_by_index[collector_index].id)
        demo_vehicles.append(vehicle)

    pickup_requests = {
        data["key"]: _ensure_pickup(
            db, citizens[index % len(citizens)], admin, data
        )
        for index, data in enumerate(PICKUPS)
    }

    for index, (pickup_key, collector_index, vehicle_index) in enumerate(
        COLLECTION_ASSIGNMENTS,
        start=1,
    ):
        request = pickup_requests[pickup_key]
        demo_collection_key = _demo_key(f"collection-{index:02d}")
        collection = db.scalar(
            select(Collection).where(Collection.demo_key == demo_collection_key)
        )
        if collection is None:
            collection = create_collection(
                db,
                CollectionCreate(
                    location=request.location,
                    waste_type=request.category,
                    scheduled_date=(
                        datetime.now(timezone.utc).replace(tzinfo=None)
                        + timedelta(days=index)
                    ),
                    notes=f"{DEMO_PREFIX} scheduled from approved pickup #{request.id}",
                    pickup_request_id=request.id,
                ),
                is_demo=True,
                demo_key=demo_collection_key,
            )

        collector = collector_by_index[collector_index]
        if collection.collector_id is None:
            collection = assign_collector(db, collection.id, collector.id)
        elif collection.collector_id != collector.id:
            raise SeedPrerequisiteError(
                f"Demo collection {index} is assigned to another Collector; it was not overwritten."
            )

        vehicle = demo_vehicles[vehicle_index - 1]
        if (
            vehicle.status != "ASSIGNED"
            or vehicle.assigned_collector_id != collector.id
        ):
            raise SeedPrerequisiteError(
                f"Demo vehicle {vehicle.vehicle_number} is not available to the "
                "selected Collector; it was not reassigned."
            )
        if collection.vehicle_id is None:
            collection.vehicle_id = vehicle.id
            db.commit()
        elif collection.vehicle_id != vehicle.id:
            raise SeedPrerequisiteError(
                f"Demo collection {index} already has another vehicle; it was not overwritten."
            )

    for index, data in enumerate(REPORTS):
        _ensure_report(db, citizens[index % len(citizens)], admin, data)

    derived_hotspots = _count_demo_hotspots(db)

    return {
        "collection_points": len(MAP_LOCATIONS) - 2,
        "reporting_offices": 2,
        "vehicles": len(VEHICLES),
        "pickup_requests": len(PICKUPS),
        "collections": len(COLLECTION_ASSIGNMENTS),
        "cleancity_reports": len(REPORTS),
        "derived_hotspots": derived_hotspots,
        "active_collectors_used": len(collectors),
    }


def _check_schema(db: Session) -> None:
    inspector = inspect(db.get_bind())
    required_columns = {
        "map_locations": {"demo_key", "is_demo"},
        "pickup_requests": {"demo_key", "is_demo"},
        "collections": {"demo_key", "is_demo"},
        "vehicles": {"demo_key", "is_demo"},
        "litter_reports": {"demo_key", "is_demo"},
    }
    for table_name, columns in required_columns.items():
        if not inspector.has_table(table_name):
            raise RuntimeError(
                f"Required table {table_name!r} is missing; run `alembic upgrade head` first."
            )
        existing_columns = {
            column["name"] for column in inspector.get_columns(table_name)
        }
        missing_columns = columns - existing_columns
        if missing_columns:
            raise RuntimeError(
                f"Required columns are missing from {table_name!r}: "
                f"{', '.join(sorted(missing_columns))}; run `alembic upgrade head` first."
            )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write demo records. Without this flag the command is read-only.",
    )
    args = parser.parse_args()

    with SessionLocal() as db:
        try:
            _check_schema(db)
            citizens, admin, collectors = _preflight(db)
            if not args.apply:
                print("Dry run: no data was written.")
                print(
                    f"Eligible accounts: {len(citizens)} active Citizens, Admin #{admin.id}, "
                    f"{len(collectors)} active Collectors."
                )
                print(
                    f"Planned demo records: {len(MAP_LOCATIONS) - 2} collection points, "
                    f"2 reporting offices, {len(VEHICLES)} vehicles, "
                    f"{len(PICKUPS)} pickup requests, "
                    f"{len(COLLECTION_ASSIGNMENTS)} collections, "
                    f"{len(REPORTS)} CleanCity reports."
                )
                return 0
            counts = seed_demo_data(db)
            print("Demo seed completed; existing non-demo records were left unchanged.")
            for name, count in counts.items():
                print(f"{name}: {count}")
            return 0
        except (RuntimeError, ValueError) as error:
            db.rollback()
            print(f"Demo seed blocked: {error}", file=sys.stderr)
            return 2
        finally:
            db.close()


if __name__ == "__main__":
    raise SystemExit(main())
