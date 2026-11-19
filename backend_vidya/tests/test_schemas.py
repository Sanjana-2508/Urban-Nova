import pytest
from pydantic import ValidationError

from app.cleancity.schemas import (
    CleanupActionCreate,
    CleanupActionUpdate,
    ReportCreate,
    ReportPublic,
    ReportReview,
    ReportStaff,
)

VALID = {
    "category": "OVERFLOWING_BIN",
    "description": "Bin overflowing near the bus stop",
    "latitude": 12.9716,
    "longitude": 77.5946,
}


def test_valid_report_is_accepted():
    r = ReportCreate(**VALID)
    assert r.category.value == "OVERFLOWING_BIN"


@pytest.mark.parametrize(
    "change",
    [
        {"latitude": 95},
        {"longitude": -200},
        {"category": "SOMETHING_ELSE"},
        {"description": ""},
        {"description": "x" * 1001},
    ],
)
def test_invalid_reports_are_rejected(change):
    with pytest.raises(ValidationError):
        ReportCreate(**{**VALID, **change})


def test_reject_needs_a_reason():
    with pytest.raises(ValidationError):
        ReportReview(decision="REJECTED")
    assert ReportReview(decision="REJECTED", reason="Not litter").decision.value == "REJECTED"


def test_duplicate_needs_duplicate_of():
    with pytest.raises(ValidationError):
        ReportReview(decision="DUPLICATE")
    assert ReportReview(decision="DUPLICATE", duplicate_of=101).duplicate_of == 101


def test_verify_needs_nothing_extra():
    assert ReportReview(decision="VERIFIED").decision.value == "VERIFIED"


def test_review_cannot_use_assigned_or_resolved():
    with pytest.raises(ValidationError):
        ReportReview(decision="RESOLVED")


def test_cleanup_due_date_is_stored_as_naive_utc():
    aware = CleanupActionCreate(assigned_to=1, priority="HIGH", due_at="2026-11-20T09:00:00+05:30")
    assert aware.due_at.tzinfo is None
    assert aware.due_at.hour == 3 and aware.due_at.minute == 30  # 09:00 IST = 03:30 UTC
    naive = CleanupActionCreate(assigned_to=1, priority="HIGH", due_at="2026-11-20T09:00:00")
    assert naive.due_at.hour == 9


def test_cleanup_create_needs_a_collector_id():
    with pytest.raises(ValidationError):
        CleanupActionCreate(priority="HIGH", due_at="2026-11-20T09:00:00")


def test_cleanup_update_only_allows_resolved():
    assert CleanupActionUpdate(status="RESOLVED").status == "RESOLVED"
    with pytest.raises(ValidationError):
        CleanupActionUpdate(status="ASSIGNED")


def test_public_report_hides_private_fields():
    assert "internal_notes" not in ReportPublic.model_fields
    assert "reporter_id" not in ReportPublic.model_fields
    assert "internal_notes" in ReportStaff.model_fields
    assert "reporter_id" in ReportStaff.model_fields
