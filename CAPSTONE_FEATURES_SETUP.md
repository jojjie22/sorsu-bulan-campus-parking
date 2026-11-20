# SorSU–Bulan Campus Park — Capstone Operations Upgrade

This release adds three working full-stack modules to the uploaded Campus Parking project:

1. **Smart Gate & Queue Management:** duration and outcome telemetry, arrival markers, hourly traffic / peak analysis, searchable recent events and CSV export.
2. **Parking Occupancy Reconciliation:** physical slot inspections, discrepancy detection, guard-submitted change requests, administrator-only review, reason/decision fields and audit trails.
3. **Smart Parking Allocation:** compatible-space ranking using area preference, free-capacity ratio, configurable administrative priority, and vehicle fit. A no-write evaluation compares the weighted decision to the alphabetical baseline.

These modules require the existing **dynamic single-use QR** and **ADMS** migrations in the uploaded project.

## Installation and safe database migration

1. Make a backup of the current database from phpMyAdmin **Export > SQL**. Keep a copy of your existing `backend/config.php` if you customized DB credentials.
2. Extract the ZIP to `C:\xampp\htdocs\campus_parking`, replacing the frontend/backend application files; **do not drop or recreate** your existing `campus_parking` MySQL database.
3. Open phpMyAdmin; select the **existing** `campus_parking` database. Confirm these upgrades were already applied: `database/ADMS_advanced_features.sql` and `database/QR_SECURITY_UPGRADE.sql`. If not, apply those files in that order first.
4. Import the **new migration** `database/CAPSTONE_OPERATIONS_UPGRADE.sql` using phpMyAdmin Import. It uses `CREATE TABLE IF NOT EXISTS` and `CREATE OR REPLACE VIEW` and does not remove existing records.
5. Start **Apache** and **MySQL** in XAMPP. Then:

```powershell
cd C:\xampp\htdocs\campus_parking\frontend
npm install
npm run dev
```

6. In a browser, visit `http://localhost/campus_parking/backend/api.php?route=health` and confirm `capstone_ops_installed: true`, and that the ADMS and dynamic QR checks are also true. If you use an alternate XAMPP port, update Vite's proxy target.

### New navigation pages

| Role | Pages |
| --- | --- |
| Administrator | Gate & queue analytics, Occupancy inspection, Slot allocation policy and evaluation |
| Security Guard | Gate & queue analytics, Occupancy inspection, Allocation evaluation |
| Student / Faculty | Preferred parking area (does not bypass vehicle compatibility or available-capacity restrictions) |

### Feature A: gate data collection

* Guard opens **Gate control**, optionally enters a gate name and chooses **Mark vehicle arrival** before a vehicle enters the processing lane. The PHP API stores the arrival timestamp.
* Existing continuous QR scan → server verification → physical plate confirmation → transaction runs unchanged. The frontend adds client scan-to-QR and guard-confirmation timing samples. The PHP API records server processing durations and verification outcomes.
* Open **Queue analytics** to filter by dates, see verification outcomes, peak entry hours, average processing time, and manually marked arrival-to-transaction wait estimates. Export the recent events to CSV.
* The sample arrival timestamp needs a manual press; it is NOT an automatic road sensor or an exact measure of roadside queue length. Client times can be spoofed, so keep server durations distinct and use test/pilot measurements for scientific claims.

### Feature B: occupancy reconciliation

* A guard visits a slot and records **occupied** (with observed plate) or **empty**.
* The inspection is compared with the currently recorded active visit. Any mismatch is clearly marked.
* For an empty slot that the DB believes is occupied, request `close_missing_exit`.
* For an occupied slot that the DB believes is empty, the observed plate must match a verified vehicle with an active permit; request `open_missing_entry`.
* If the observed plate differs from an already recorded occupied slot, **investigate and reinspect**; never automatically swap a vehicle to hide the discrepancy.
* An administrator reviews pending requests, supplies a resolution, and approves/rejects. Approval runs inside a database transaction with fresh state checks and audit entries. If the admin initiated the request personally, another admin must review it.
* No physical inspection alters the database occupancy directly. Two active visits for the same vehicle/slot are blocked by existing DB unique keys.

### Feature C: allocation ranking

The real gate entry transaction now calls `allocationCandidates()` from `backend/allocation.php`. It considers **only active, compatible, policy-enabled, unoccupied** parking spaces, and ranks them with:

`score = (preferred area ? 100 : 0) + 0.4 * area priority + 40 * (compatible free / compatible total) + (exact vehicle type ? 5 : 0)`

Priority ranges from 0 to 100. The ranking is deterministic, with area, slot code and ID as tie breakers. The algorithm preview lists its top 10 candidates, scores, and the first alphabetically available candidate as a baseline. It does not mutate occupancy.

This is an interpretable **heuristic** — it does not claim minimum driving distance or prove real-world congestion reduction. Capacity ratios measure the current free-slot fraction, not physical travel time. Measure actual gate times and parking usage in a pilot.

### New PHP API routes

All operations authenticate via the existing bearer-token session; the PHP layer enforces role permissions.

| HTTP | Route | Roles |
| --- | --- | --- |
| POST | `gate/arrival` | admin, guard |
| GET | `gate/metrics?start=YYYY-MM-DD&end=YYYY-MM-DD` | admin, guard |
| GET/POST | `inspections` | admin, guard |
| GET/POST | `reconciliations` | admin, guard |
| POST | `reconciliations/review` | admin only |
| GET/POST | `allocation/preference` | GET signed-in; POST student, faculty |
| GET | `allocation/policies` | admin, guard |
| POST | `allocation/policies` | admin |
| GET | `allocation/evaluate?vehicle_id=123` | admin, guard |

### Suggested capstone acceptance tests

1. Repeat a used or expired QR: gate denies it; verify denial is counted in analytics.
2. Process a vehicle entry: a compatible slot is automatically chosen; the slot is unavailable for a second simultaneous entry.
3. Record a vehicle arrival manually, wait, and complete entry: the arrival-to-transaction interval appears in metrics.
4. Inspect a recorded-occupied slot as empty: request a missing-exit correction. Guard cannot approve. Administrator approves; occupancy becomes available and `audit_logs` records the change.
5. Attempt an inspection mismatch correction for a different observed plate on an occupied slot: investigate rather than silently replace the vehicle.
6. Save an area priority, change a user's preferred area and run allocation evaluation. Verify the scoring results and compare with alphabetical baseline.
7. Simultaneous gate entries and correction approvals: verify uniqueness of active visits and error feedback. This must be tested with a running MySQL server; static checks alone cannot validate concurrency behavior.
8. Test phone and tablet layouts and QR camera access over localhost/HTTPS. For a LAN mobile phone, use HTTPS (not plain HTTP on a LAN IP).

### Existing code retained

The uploaded PHP API, ADMS triggers/procedures/events, QR token flow, four role dashboards, maroon design, permit validity and historical records are preserved. The new migration is additive. Do not import the original schema over a populated database.

## Test status

Source syntax, import paths and pure allocation scoring are validated in this package. No live MySQL / camera / on-campus pilot tests were possible in the build environment. Use a backup copy of your database for first integration tests.
