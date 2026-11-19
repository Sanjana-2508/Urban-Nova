# CleanCity integration notes (for review with Sanjana)

Status: built and tested, **not merged**. All code is in `backend_vidya/app/cleancity/` as agreed.
Tested by copying these files into a copy of `feature/backend` with an in-memory SQLite database:
64 tests pass (pure logic + API flow). **Not yet run against MySQL** — the migration needs checking there.

## What to review first
1. `models.py` — four new tables: `litter_reports`, `report_reviews`, `cleanup_actions`, `awareness_content`.
   Every foreign key to `users.id` is nullable with `ON DELETE SET NULL`. `report_id` foreign keys cascade.
   No foreign keys to `complaints`, `collections` or `vehicles`.
2. `routes.py` — all endpoints; role checks are inline like the existing routes.
3. `CLEANCITY_API.md` — the API as built.

## Edits needed in the main backend (four small ones)
1. `app/main.py`: add
   ```python
   from app.cleancity.routes import router as cleancity_router
   app.include_router(cleancity_router)
   ```
2. `alembic/env.py`: add `import app.cleancity.models  # noqa: F401` so autogenerate sees the new tables.
3. Create the migration: `alembic revision --autogenerate -m "add cleancity tables"` and review it.
4. After migrating, load the tips once: `python -m app.cleancity.seed` (safe to repeat).

Layout: simplest is to copy `backend_vidya/app/cleancity/` into `backend/app/cleancity/` unchanged (imports already
use `app.cleancity...`). If you prefer one file per layer like the existing code (models/schemas/services/api/routes),
the split is `models.py`, `schemas.py`, `service.py` and `routes.py`; only import paths change.
Copy `backend_vidya/tests/` files too. The API test needs `httpx` (dev only); `python-multipart` is already in requirements.

## Things that differ from the existing conventions (please check)
- `created_at` / `updated_at` on CleanCity tables use a Python-side UTC default, not the database `now()`, because hotspot
  time windows must not depend on the MySQL server's time zone. Values are still naive UTC datetimes.
- Photos are saved to `uploads/cleancity/` (override with env var `CLEANCITY_UPLOAD_DIR`), which is gitignored.
  The database keeps only a random file name.
- Review is two steps by design: SUBMITTED → UNDER_REVIEW → VERIFIED. Say if admins should be able to verify directly.
- `GET /awareness` requires login like everything else.
- Citizen-facing responses never include `reporter_id` or internal notes; collectors only see reports assigned to them.

## Open questions
- Complaints vs litter reports: one citizen form or two (needs Member 1)?
- Should hotspot results be visible to citizens, or admins and collectors only?
