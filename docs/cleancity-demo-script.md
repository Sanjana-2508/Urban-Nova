# CleanCity demo script (Member 4) — about 3 minutes

Fill in the bracketed parts once the module is connected to the backend and frontend.

## 1. The problem (20 s)
Litter reports are scattered, nobody can tell if a report was checked or fixed, and the same
spots get dirty again and again. CleanCity turns each report into a tracked case.

## 2. Citizen files a report (40 s)
- Open the report form [screen from Member 1].
- Drop a pin on the map, pick a category, write one line, attach a photo.
- Show the confirmation: status is **SUBMITTED**.
- Point out: only JPEG/PNG up to 5 MB are accepted, and the stored file gets a random name.

## 3. Staff review and cleanup (60 s)
- Log in as staff and open the new report.
- Verify it (or reject it with a reason, or mark a duplicate).
- Assign a cleanup action with a priority and due date: status becomes **ASSIGNED**.
- Mark it resolved with a note: status becomes **RESOLVED**.
- Show the status history. Point out: the citizen sees the status but never the internal notes.

## 4. Hotspots (40 s)
- Open the hotspot layer on the map.
- Explain the rule in one sentence: a map cell with 3 or more verified reports in 30 days.
- Show a **REPEAT** hotspot: this spot was reported in the previous period too.
- Be clear it is a counting rule, not AI prediction.

## 5. Awareness (20 s)
- Show the segregation and disposal tips page.

## 6. What the tests cover (20 s)
- Status rules, hotspot rule, upload checks and request validation each have unit tests.
- [Add the integration test of the full report flow once it exists.]

## Questions to be ready for
- What if someone submits false reports? Every report is reviewed before it counts.
- Why not AI? The rule is transparent and checkable; AI prediction is out of MVP scope.
- Is the data real? [Say clearly whether the demo data is sample data.]
