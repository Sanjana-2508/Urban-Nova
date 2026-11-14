# CleanCity API Contract (Member 4) — PROPOSED

Status: **proposal, v0.1**. Team: reply with changes before the freeze date; otherwise this is what will be built.
Base path: `/api/v1`. All timestamps are ISO 8601 in UTC (e.g. `2026-11-14T09:30:00Z`).
Coordinates are always `latitude` / `longitude` (decimal degrees).

## 1. Report statuses

`SUBMITTED`, `UNDER_REVIEW`, `VERIFIED`, `REJECTED`, `ASSIGNED`, `RESOLVED`, `DUPLICATE`

### Allowed transitions

| From | To |
| --- | --- |
| SUBMITTED | UNDER_REVIEW, REJECTED, DUPLICATE |
| UNDER_REVIEW | VERIFIED, REJECTED, DUPLICATE |
| VERIFIED | ASSIGNED |
| ASSIGNED | RESOLVED |

REJECTED, DUPLICATE and RESOLVED are final. Every change is recorded with actor and timestamp.

## 2. Common error format

```json
{ "error": { "code": "INVALID_TRANSITION", "message": "Cannot move SUBMITTED to RESOLVED" } }
```

Codes: `VALIDATION_ERROR` (400), `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `INVALID_TRANSITION` (409).

## 3. Endpoints

### POST /reports — Citizen
Submit a litter report. `multipart/form-data` if a photo is attached, otherwise JSON.

Request:
```json
{
  "category": "OVERFLOWING_BIN",
  "description": "Bin overflowing near the bus stop",
  "latitude": 12.9716,
  "longitude": 77.5946,
  "reported_at": "2026-11-14T09:30:00Z"
}
```
Photo: optional, jpg/png only, max size to be agreed (suggest 5 MB). Server renames the file; client filename is never trusted.

Response `201`:
```json
{ "id": 101, "status": "SUBMITTED", "submitted_at": "2026-11-14T09:30:05Z" }
```

### GET /reports — Staff (all) / Citizen (own only)
Filters: `status`, `from`, `to`, `zone_id`, `bounds` (`south,west,north,east`).

Response `200` (citizen-safe fields; staff additionally get `internal_notes` and `reporter_id`):
```json
{
  "items": [
    {
      "id": 101,
      "category": "OVERFLOWING_BIN",
      "description": "Bin overflowing near the bus stop",
      "latitude": 12.9716,
      "longitude": 77.5946,
      "status": "VERIFIED",
      "severity": "MEDIUM",
      "submitted_at": "2026-11-14T09:30:05Z",
      "evidence_url": null
    }
  ]
}
```

### POST /reports/{id}/review — Authorized staff
Request:
```json
{ "decision": "VERIFIED", "reason": "Photo matches location", "internal_note": "Seen by ward officer" }
```
`decision`: `UNDER_REVIEW`, `VERIFIED`, `REJECTED` or `DUPLICATE`. `duplicate_of` (report id) required for `DUPLICATE`. `reason` required for `REJECTED`.
Response `200`: `{ "id": 101, "status": "VERIFIED" }`. Never returns `internal_note` to citizens.

### POST /reports/{id}/cleanup-actions — Manager / authorized staff
Request:
```json
{ "assigned_to": 7, "priority": "HIGH", "due_at": "2026-11-16T12:00:00Z" }
```
Only allowed when report is `VERIFIED`. Moves report to `ASSIGNED`.
Response `201`: `{ "id": 55, "report_id": 101, "status": "ASSIGNED" }`

### PATCH /cleanup-actions/{id} — Assigned staff / Manager
Request:
```json
{ "status": "RESOLVED", "resolution_note": "Cleared and bin emptied" }
```
After-photo optional. Moves report to `RESOLVED`.
Response `200`: `{ "id": 55, "status": "RESOLVED", "resolved_at": "2026-11-15T10:00:00Z" }`

### GET /hotspots — Authenticated (public subset optional)
Filters: `zone_id`, `bounds`, `from`, `to`.

Rule (documented, not AI): a cell is a hotspot when it has **N or more VERIFIED reports within the time window**. Defaults to be agreed (suggest N = 3, window = 30 days, cell = zone or fixed grid).

Response `200`:
```json
{
  "method": "count_of_verified_reports",
  "period_start": "2026-10-15T00:00:00Z",
  "period_end": "2026-11-14T23:59:59Z",
  "items": [
    {
      "zone_id": 2,
      "latitude": 12.97,
      "longitude": 77.59,
      "report_count": 4,
      "last_reported_at": "2026-11-13T18:00:00Z",
      "recurrence": "REPEAT"
    }
  ]
}
```

## 4. Privacy rules

- Reporter name, phone, email are never returned to citizens or on any public layer.
- Citizens see only their own reports; internal notes are staff-only.
- Photos are stored outside Git and outside DB rows (only a storage key is kept).

## 5. Open items for the team

- Photo size limit and storage location (needs Member 2).
- Hotspot defaults: N, time window, cell size.
- Category list (suggest: `OVERFLOWING_BIN`, `ILLEGAL_DUMPING`, `LITTER`, `OTHER`).