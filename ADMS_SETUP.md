# Advanced Database Features & Responsive Interface

**Project:** SorSU–Bulan Campus Park  
**Stack:** React/Vite + PHP/PDO + MySQL/MariaDB on XAMPP

## Important: preserve your existing database

Do **not** delete your current `campus_parking` database. The advanced-feature SQL is a schema upgrade, not a replacement. Back up your database in **phpMyAdmin → Export → Quick → SQL** before importing the migration. The upgrade adds an `expired` permit status and named database objects; it does not drop your users, vehicles, permits, or visits.

### Installation for an EXISTING XAMPP system

1. Start **Apache** and **MySQL**.
2. Back up `campus_parking` with phpMyAdmin → Export.
3. In phpMyAdmin select `campus_parking`, choose **Import**, and import **`database/ADMS_advanced_features.sql`**. Run the migration completely before using the updated PHP API. The migration replaces only its named triggers, views, stored procedures, and scheduled event when rerun.
4. In phpMyAdmin → SQL, check the scheduler:

```sql
SHOW VARIABLES LIKE 'event_scheduler';
```

If it is `OFF`, an authorized MySQL/MariaDB administrator can run:

```sql
SET GLOBAL event_scheduler = ON;
```

This setting may be lost on MySQL restart; enable `event_scheduler=ON` in your **MySQL/MariaDB configuration** under `[mysqld]` for persistence, then restart the database. A user without global privileges should ask their database administrator to enable it. The event will not run while the scheduler is OFF.

5. Replace your project's frontend and backend code with the revised files, then in PowerShell:

```powershell
cd C:\xampp\htdocs\campus_parking\frontend
npm install
npm run dev
```

6. Open `http://localhost/campus_parking/backend/api.php?route=health`. Check that `"adms_installed":true`. Use the Vite URL printed by the dev server to sign in.

For a **fresh system**, first import `database/campus_parking.sql`, run `backend/seed.php` from PHP CLI, and **then** import `database/ADMS_advanced_features.sql`.

## 1. Triggers (automatic audit logging)

- `trg_permit_status_audit`: records changes to permit status, including expiration.
- `trg_visit_entry_audit`: records newly inserted parking visits.
- `trg_visit_exit_audit`: records visits closed at exit.

The triggers append to the existing `audit_logs` table. They supplement application audit records rather than replacing them; entries starting with `db.` identify database-generated records.

## 2. Stored procedures

- `sp_record_parking_entry(permit_id, vehicle_id, slot_id, plate_number, guard_id)` validates the permit, vehicle and parking slot, then creates the parking visit.
- `sp_record_parking_exit(vehicle_id, guard_id)` closes an active visit and frees its assigned slot (occupancy is derived from visits).
- `sp_expire_parking_permits()` changes expired approved permits to `expired`.

The PHP API invokes the entry and exit procedures **inside its existing InnoDB transactions** with row locking and server-side authorization. Do not call these procedures directly from public or untrusted clients. For demonstration use valid IDs from your **test** database only.

## 3. Views (read-only reporting)

| View | Purpose |
|---|---|
| `vw_parking_availability` | Current slot state, including occupied plate |
| `vw_parking_area_summary` | Per-area totals, active slots, occupied and available |
| `vw_active_permits` | Unexpired approved permits without QR secrets |
| `vw_daily_parking_activity` | Visits grouped by their entry day |

Demo queries for phpMyAdmin:

```sql
SELECT * FROM vw_parking_availability ORDER BY area, code;
SELECT * FROM vw_parking_area_summary ORDER BY name;
SELECT * FROM vw_active_permits LIMIT 20;
SELECT * FROM vw_daily_parking_activity ORDER BY day DESC LIMIT 10;
```

For `vw_daily_parking_activity`, the `exits` count means visits *entered on that date* which have since been closed; it does not mean exits that happened on the date.

## 4. Scheduled event

- `ev_expire_parking_permits` runs `sp_expire_parking_permits()` once per day.
- A one-time cleanup is also performed during migration.
- Permits are valid **through** their `expires_at` date; expiry status is set after that date.
- Gate entry is rejected for an expired permit even if the event scheduler has not run yet; the API independently checks expiry.
- An expired permit is still allowed to **exit** if its vehicle is currently parked.

Demo queries:

```sql
SHOW TRIGGERS FROM campus_parking;
SHOW PROCEDURE STATUS WHERE Db = 'campus_parking';
SHOW FULL TABLES FROM campus_parking WHERE Table_type = 'VIEW';
SHOW EVENTS FROM campus_parking;
SHOW VARIABLES LIKE 'event_scheduler';
```

If the scheduler is unavailable, an administrator may manually run:

```sql
CALL sp_expire_parking_permits();
```

## Device responsiveness

`frontend/src/responsive.css` is loaded **after** the main design system. It adds the following behavior:

- **Desktop (>1024px):** permanent maroon sidebar, multi-column dashboard.
- **Tablet/iPad (601–1024px):** slide-in navigation drawer, stacked gate panels, flexible dashboard grids.
- **Phone (≤600px):** compact cards, stacked forms, full-width dialogs/actions and two-column parking slot grid.
- **Very narrow phones (≤370px):** additional spacing and type adjustments.
- Tables retain every column with touch-friendly **horizontal scrolling** (not removed data).
- Camera remains usable on supported mobile browsers when the website is on **HTTPS** (or localhost). Accessing a LAN IP on plain HTTP will usually block camera access.

## Validation limitations

The project includes dependency-free static checks. These check PHP syntax, import paths and migration objects, but they **do not replace** running the SQL against your XAMPP MySQL/MariaDB version, building the React frontend, or checking device layouts in a browser. For your ADMS presentation, test import and entry/exit transactions against a **backup** first.
