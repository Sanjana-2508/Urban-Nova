"""Hotspot detection for CleanCity.

Documented rule (a counting heuristic, NOT an AI prediction):

- Only reports that staff have verified are counted. A report stays "verified"
  after it is assigned or resolved, so VERIFIED, ASSIGNED and RESOLVED all count.
  SUBMITTED, UNDER_REVIEW, REJECTED and DUPLICATE do not.
- The map is split into square grid cells of `cell_size_deg` degrees
  (0.005 degrees is roughly 550 m in latitude).
- A cell is a hotspot when it has at least `min_reports` counted reports inside
  the window (period_end - window_days, period_end].
- recurrence is "REPEAT" if the same cell also had at least one counted report
  in the previous window of the same length, otherwise "NEW".

Defaults (min_reports=3, window_days=30, cell_size_deg=0.005) are proposals and
should be agreed with the team.
"""

import math
from dataclasses import dataclass
from datetime import datetime, timedelta

from .status import ReportStatus

COUNTED_STATUSES = {
    ReportStatus.VERIFIED,
    ReportStatus.ASSIGNED,
    ReportStatus.RESOLVED,
}


@dataclass(frozen=True)
class ReportPoint:
    id: int
    latitude: float
    longitude: float
    status: ReportStatus
    reported_at: datetime  # timezone-aware, UTC


@dataclass(frozen=True)
class Hotspot:
    latitude: float  # centre of the grid cell
    longitude: float
    report_count: int
    last_reported_at: datetime
    recurrence: str  # "NEW" or "REPEAT"


def cell_of(latitude: float, longitude: float, cell_size_deg: float) -> tuple[int, int]:
    return (
        math.floor(latitude / cell_size_deg),
        math.floor(longitude / cell_size_deg),
    )


def cell_center(cell: tuple[int, int], cell_size_deg: float) -> tuple[float, float]:
    return (
        round((cell[0] + 0.5) * cell_size_deg, 6),
        round((cell[1] + 0.5) * cell_size_deg, 6),
    )


def find_hotspots(
    reports: list[ReportPoint],
    period_end: datetime,
    window_days: int = 30,
    min_reports: int = 3,
    cell_size_deg: float = 0.005,
) -> list[Hotspot]:
    if window_days <= 0 or min_reports < 1 or cell_size_deg <= 0:
        raise ValueError("window_days, min_reports and cell_size_deg must be positive")

    window = timedelta(days=window_days)
    period_start = period_end - window
    previous_start = period_start - window

    current: dict[tuple[int, int], list[datetime]] = {}
    previous: set[tuple[int, int]] = set()

    for r in reports:
        if r.status not in COUNTED_STATUSES:
            continue
        cell = cell_of(r.latitude, r.longitude, cell_size_deg)
        if period_start < r.reported_at <= period_end:
            current.setdefault(cell, []).append(r.reported_at)
        elif previous_start < r.reported_at <= period_start:
            previous.add(cell)

    hotspots = []
    for cell, times in current.items():
        if len(times) >= min_reports:
            lat, lon = cell_center(cell, cell_size_deg)
            hotspots.append(
                Hotspot(
                    latitude=lat,
                    longitude=lon,
                    report_count=len(times),
                    last_reported_at=max(times),
                    recurrence="REPEAT" if cell in previous else "NEW",
                )
            )

    hotspots.sort(key=lambda h: (-h.report_count, h.latitude, h.longitude))
    return hotspots