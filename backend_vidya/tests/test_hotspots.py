from datetime import datetime, timedelta, timezone

import pytest

from app.cleancity.hotspots import ReportPoint, find_hotspots
from app.cleancity.status import ReportStatus

NOW = datetime(2026, 11, 14, tzinfo=timezone.utc)

# Three nearby points that fall in the same 0.005-degree grid cell
SAME_CELL = [(12.9716, 77.5946), (12.9717, 77.5947), (12.9718, 77.5948)]
FAR_CELL = (12.9352, 77.6245)


def make(id, latlon, status=ReportStatus.VERIFIED, days_ago=1):
    return ReportPoint(
        id=id,
        latitude=latlon[0],
        longitude=latlon[1],
        status=status,
        reported_at=NOW - timedelta(days=days_ago),
    )


def three_verified():
    return [make(i, SAME_CELL[i], days_ago=i + 1) for i in range(3)]


def test_three_verified_reports_make_a_hotspot():
    result = find_hotspots(three_verified(), NOW)
    assert len(result) == 1
    assert result[0].report_count == 3


def test_two_reports_are_not_enough():
    result = find_hotspots(three_verified()[:2], NOW)
    assert result == []


@pytest.mark.parametrize(
    "status",
    [
        ReportStatus.SUBMITTED,
        ReportStatus.UNDER_REVIEW,
        ReportStatus.REJECTED,
        ReportStatus.DUPLICATE,
    ],
)
def test_unverified_statuses_are_ignored(status):
    reports = three_verified()[:2] + [make(9, SAME_CELL[2], status=status)]
    assert find_hotspots(reports, NOW) == []


def test_assigned_and_resolved_still_count():
    reports = [
        make(1, SAME_CELL[0], status=ReportStatus.VERIFIED),
        make(2, SAME_CELL[1], status=ReportStatus.ASSIGNED),
        make(3, SAME_CELL[2], status=ReportStatus.RESOLVED),
    ]
    result = find_hotspots(reports, NOW)
    assert len(result) == 1
    assert result[0].report_count == 3


def test_reports_outside_window_are_ignored():
    reports = [
        make(1, SAME_CELL[0], days_ago=1),
        make(2, SAME_CELL[1], days_ago=2),
        make(3, SAME_CELL[2], days_ago=45),
    ]
    assert find_hotspots(reports, NOW) == []


def test_different_cells_are_not_combined():
    reports = [
        make(1, SAME_CELL[0]),
        make(2, SAME_CELL[1]),
        make(3, FAR_CELL),
    ]
    assert find_hotspots(reports, NOW) == []


def test_new_hotspot_has_no_earlier_history():
    result = find_hotspots(three_verified(), NOW)
    assert result[0].recurrence == "NEW"


def test_repeat_hotspot_had_reports_in_previous_window():
    reports = three_verified() + [make(10, SAME_CELL[0], days_ago=40)]
    result = find_hotspots(reports, NOW)
    assert result[0].recurrence == "REPEAT"
    assert result[0].report_count == 3  # the old report is not counted now


def test_last_reported_at_is_the_latest_report():
    result = find_hotspots(three_verified(), NOW)
    assert result[0].last_reported_at == NOW - timedelta(days=1)


def test_hotspot_position_is_the_cell_centre():
    result = find_hotspots(three_verified(), NOW)
    assert result[0].latitude == pytest.approx(12.9725)
    assert result[0].longitude == pytest.approx(77.5925)


@pytest.mark.parametrize(
    "kwargs",
    [{"window_days": 0}, {"min_reports": 0}, {"cell_size_deg": 0}],
)
def test_invalid_parameters_raise(kwargs):
    with pytest.raises(ValueError):
        find_hotspots([], NOW, **kwargs)