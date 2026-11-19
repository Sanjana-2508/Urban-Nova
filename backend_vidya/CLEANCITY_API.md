# CleanCity API (v0.2 — implemented)

Supersedes the v0.1 proposal in `docs/cleancity-api.md` (PR #2). Everything below exists in code
in `backend_vidya/app/cleancity/` and is covered by tests.

- Base path: `/api/cleancity` (same `/api/` convention as the main backend)
- Auth: the main backend's JWT (`Authorization: Bearer <token>`) via `get_current_user`. No separate login.
- Roles: `CITIZEN`, `COLLECTOR`, `ADMIN` (existing `UserRole`)
- Errors: FastAPI's standard `{"detail": "..."}` with 401, 403, 404, 409, 413, 422
- Timestamps: set by the server, naive UTC like the rest of the backend. Clients never send them.
- Interactive docs: `/docs` once the router is included.

## Report status flow

`SUBMITTED → UNDER_REVIEW → VERIFIED → ASSIGNED → RESOLVED`
Also: `SUBMITTED` or `UNDER_REVIEW` → `REJECTED` or `DUPLICATE`. REJECTED, DUPLICATE and RESOLVED are final.
Steps cannot be skipped (a report must be UNDER_REVIEW before it can be VERIFIED); an invalid move returns `409`.

## Endpoints

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/reports` | any logged-in user | Submit a report (status SUBMITTED) |
| POST | `/reports/{id}/photo` | reporter or ADMIN | Attach one JPEG/PNG photo (max 5 MB) |
| GET | `/reports` | logged in | List reports (`?status=` filter) |
| GET | `/reports/{id}` | reporter, ADMIN, assigned COLLECTOR | One report |
| GET | `/reports/{id}/photo` | same as above | Download the photo |
| POST | `/reports/{id}/review` | ADMIN | UNDER_REVIEW / VERIFIED / REJECTED / DUPLICATE |
| POST | `/reports/{id}/cleanup-actions` | ADMIN | Assign a VERIFIED report to a collector |
| PATCH | `/cleanup-actions/{id}` | ADMIN or the assigned COLLECTOR | Mark resolved |
| GET | `/hotspots` | logged in | Hotspot cells (`window_days`, `min_reports`, `cell_size_deg`) |
| GET | `/awareness` | logged in | Active awareness tips |

Who sees what in `GET /reports`: CITIZEN sees only their own; COLLECTOR sees only reports assigned to them;
ADMIN sees all. Other people's reports return `404`, not `403`, so IDs are not revealed.

### POST /reports
```json
{ "category": "OVERFLOWING_BIN", "description": "Bin overflowing near the bus stop",
  "latitude": 12.9716, "longitude": 77.5946 }
```
Categories: `OVERFLOWING_BIN`, `ILLEGAL_DUMPING`, `LITTER`, `OTHER`. Response `201`:
```json
{ "id": 101, "category": "OVERFLOWING_BIN", "description": "Bin overflowing near the bus stop",
  "latitude": 12.9716, "longitude": 77.5946, "status": "SUBMITTED", "severity": null,
  "submitted_at": "2026-11-14T09:30:05", "evidence_url": null }
```

### POST /reports/{id}/photo
`multipart/form-data`, field name `file`. Only JPEG or PNG; the type is checked from the file's contents, the
client filename is ignored and the stored name is random. `400` bad type, `413` too large, `409` already has a photo.
Response is the report with `evidence_url` set to `/api/cleancity/reports/{id}/photo`.

### GET /reports and GET /reports/{id}
Citizens and collectors get the fields shown above. **ADMIN responses add** `reporter_id` and
`internal_notes` (list of strings from reviews). Citizens never receive those two keys.

### POST /reports/{id}/review (ADMIN)
```json
{ "decision": "VERIFIED", "reason": null, "internal_note": "Photo matches location",
  "duplicate_of": null, "severity": "HIGH" }
```
`reason` is required for REJECTED; `duplicate_of` (another existing report id) is required for DUPLICATE;
`severity` (LOW/MEDIUM/HIGH) is optional. Returns the staff view of the report.

### POST /reports/{id}/cleanup-actions (ADMIN)
```json
{ "assigned_to": 7, "priority": "HIGH", "due_at": "2026-12-01T09:00:00" }
```
The report must be VERIFIED (else `409`); `assigned_to` must be an active COLLECTOR (else `400`). Response `201`:
```json
{ "id": 55, "report_id": 101, "assigned_to": 7, "priority": "HIGH", "status": "ASSIGNED",
  "due_at": "2026-12-01T09:00:00", "resolved_at": null, "resolution_note": null }
```

### PATCH /cleanup-actions/{id}
```json
{ "status": "RESOLVED", "resolution_note": "Cleared and bin emptied" }
```
A COLLECTOR can only resolve actions assigned to them (`403` otherwise). Resolving twice returns `409`.

### GET /hotspots
Defaults: `window_days=30`, `min_reports=3`, `cell_size_deg=0.005` (about 550 m).
Rule (a counting rule, not AI prediction): a grid cell is a hotspot when it has at least `min_reports` verified reports
(status VERIFIED, ASSIGNED or RESOLVED) in the window. `recurrence` is `REPEAT` if the same cell also had
verified reports in the previous window of the same length, otherwise `NEW`.
```json
{ "method": "count_of_verified_reports", "period_start": "...", "period_end": "...",
  "items": [ { "latitude": 12.9725, "longitude": 77.5925, "report_count": 4,
               "last_reported_at": "2026-11-13T18:00:00+00:00", "recurrence": "REPEAT" } ] }
```
`latitude`/`longitude` are the centre of the cell.

### GET /awareness
`[ { "id": 1, "title": "...", "category": "Segregation", "body": "..." } ]` — active items only.

## Changes from the v0.1 proposal
- Path prefix `/api/v1` became `/api/cleancity`.
- Photo upload is its own endpoint instead of being part of `POST /reports`.
- Client no longer sends `reported_at`; the server sets the time.
- Errors use FastAPI's `{"detail": ...}` instead of a custom error object.
- Report list filters trimmed to `status` for now (date, zone and map-bounds filters not built).
- "Staff" and "manager" roles became ADMIN and COLLECTOR, matching the existing roles.
