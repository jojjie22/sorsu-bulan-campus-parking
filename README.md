> **Frontend maroon redesign:** See [FRONTEND_REDESIGN.md](FRONTEND_REDESIGN.md) for the design system, new modular architecture, setup, and verification notes.

# CampusPark — Campus Parking Management System

A full-stack parking management application with **React + Vite frontend, PHP REST API, and MySQL database**, designed to run under **XAMPP** on Windows. Includes four roles, vehicles, verification, permits, QR, gate entry/exit, slot availability, analytics, reports, activity logging and settings.

## Requirements
- XAMPP with Apache, MySQL/MariaDB, PHP 8.1+ and PHP PDO MySQL enabled
- Node.js 18+ with npm
- Modern Chrome/Edge browser (camera access needs `localhost` or HTTPS)

## 1. Copy to XAMPP
Extract the folder **campus_parking** inside `C:\xampp\htdocs\`, so paths look like:

```
C:\xampp\htdocs\campus_parking\backend\api.php
C:\xampp\htdocs\campus_parking\database\campus_parking.sql
C:\xampp\htdocs\campus_parking\frontend\package.json
```

## 2. Import the database
1. Start **Apache** and **MySQL** in the XAMPP Control Panel.
2. Browse to http://localhost/phpmyadmin
3. Choose **Import** and select `database/campus_parking.sql`. The script creates the `campus_parking` database and tables and preloads three parking areas.
4. If your MySQL root user has a password or the port is not `3306`, edit `backend/config.php`.

## 3. Seed demo accounts and parking slots
Open PowerShell / terminal:

```powershell
cd C:\xampp\htdocs\campus_parking
C:\xampp\php\php.exe backend\seed.php
```

Seed is safe to rerun: existing user passwords are left unchanged and slot duplicates are ignored. If accounts already exist but the demo passwords are not working, you can deliberately reset ONLY the four demo passwords on your local testing machine with `C:\xampp\php\php.exe backend\seed.php --reset-demo-passwords`. Do not use this option on a deployed campus system. New demo accounts:

| Account | Email | Password |
|---|---|---|
| Admin | admin@campus.test | Admin123! |
| Guard | guard@campus.test | Guard123! |
| Student | student@campus.test | Student123! |
| Faculty / Staff | faculty@campus.test | Faculty123! |

**Demo credentials are for local testing only. Change them before any wider deployment.** The public registration screen only allows Student or Faculty/Staff; use the administrator dashboard to add Guard/Admin accounts.

## 4. Run the React frontend
In a new terminal:

```powershell
cd C:\xampp\htdocs\campus_parking\frontend
npm install
npm run dev
```

Open the Vite URL, usually **http://localhost:5173**. Vite proxies `/api/*` requests to `http://localhost/campus_parking/backend/*`. If port 5173 is busy, Vite will use a free port. If Apache uses a different host/port, edit `frontend/vite.config.js` proxy target.

Test the PHP API separately: **http://localhost/campus_parking/backend/api.php?route=health** should return `{"ok":true,"service":"campus-parking"}`.

### Production build (Apache, local test)

```powershell
cd C:\xampp\htdocs\campus_parking\frontend
npm run build
```

Open `http://localhost/campus_parking/frontend/dist/` (requires Apache folder access). The frontend detects production mode and calls `/campus_parking/backend/api.php` directly. For a differently named folder, update the frontend's production API URL by setting `VITE_API_URL` in a `.env.production` file and rebuild. `VITE_API_URL` should be the full public URL or path to the PHP API. The Vite `base: './'` supports relative asset paths.

## How to use
1. Sign in as **Student** / **Faculty**. Register a vehicle (plate, type, brand, model, color and ownership).
2. Sign in as **Admin**. Navigate to **Vehicles** and verify the registration.
3. As the original user, open **My Permits** and request a permit for a verified vehicle.
4. As **Admin**, approve the pending permit. The approval generates a unique code and secret-backed QR payload, with a policy-based expiry date.
5. As the owner, open **My Permits → View QR** and show the QR on the screen or save the SVG. The QR stores `CPM|permit-code|secret-token`.
6. As **Guard**, open **Gate Scanner**. Scan the QR via camera or enter its full payload into the manual input. Choose a compatible available parking slot and record **Entry**.
7. Scan the **same QR** at exit to record **Exit** and release that slot. The current active visit determines the required action.
8. All authorized users can view live parking availability. The frontend refreshes counts approximately every 12–15 seconds (polling).

## Permission overview
- **Administrator**: manage user roles and status, verify vehicles, review permits, manage areas/slots, use gate scanner, view logs, reports, settings and audit trail.
- **Guard**: view availability, scan permits, record entry/exit and view visit logs.
- **Student / Faculty**: self-register, see own vehicles and permits, request permits, show own QR, view availability.

## Notes and design decisions
- Auth uses **random bearer tokens**: the database only stores SHA-256 hashes of issued tokens. Tokens expire after 7 days; frontend stores the token in localStorage. Passwords are hashed using `password_hash()` and verified using `password_verify()`.
- SQL uses PDO prepared statements. Gate record changes run in InnoDB transactions. Unique generated-column constraints in `parking_visits` enforce at most one active vehicle per slot and one active visit per vehicle.
- Parking slot `status` can be active or unavailable. Actual occupancy is **derived from active visits**, not a separately maintained flag.
- Permit QR includes a random secret, but its holder can show/reuse it. This is a **demo-level bearer QR**, not an anti-cloning or identity-verification solution. Security must verify plate/driver identity in person. Don't expose raw QR content in public channels.
- Reports include daily entries and a count of those entries whose visits have ended; this is not a separate grouping of exit timestamps. Export is CSV, not PDF.
- Availability is near real-time via **polling**, not WebSockets. For high traffic, add queues, short-lived access challenge tokens, monitoring, rate limits, HTTPS, and institutional security review.
- The system does not send emails/SMS automatically, require payment, support physical barrier integration, or issue push notifications.
- Default sample user accounts and seed.php must be removed/secured for a real campus rollout. Restrict database and backend network exposure, use HTTPS, protect against stolen tokens, add rate limiting, central audit log retention, backups, and proper administrative onboarding.

## Troubleshooting
- **`Database error`**: Check XAMPP MySQL, database import, db credentials in `backend/config.php`, PDO MySQL availability.
- **Cannot connect**: Check Apache running and exact folder path `campus_parking`. Test API health URL and proxy.
- **Camera won't open**: Allow camera permission, use localhost/HTTPS, check device browser, or use manual QR input (useful with USB barcode scanners).
- **A table already exists**: The SQL uses `IF NOT EXISTS`; when upgrading from a different old schema, use a fresh database or migrate existing tables separately.
- **`npm` not recognized**: Install Node.js LTS and reopen terminal.
- **Port already in use**: Vite selects another available port; the URL printed by npm is authoritative.

## Project tree
```
campus_parking/
  backend/
    api.php          # authenticated JSON routes
    db.php           # PDO connection
    config.php       # database config
    seed.php         # CLI demo users and slots
  database/
    campus_parking.sql
  frontend/
    index.html
    vite.config.js
    package.json
    src/
      api.js
      main.jsx
      App.jsx
      style.css
  README.md
```

## React frontend architecture (modular folder structure)

The frontend was refactored to separate feature pages, dashboard sections, low-level UI primitives, hooks, and shared utilities. All existing PHP API endpoints and database tables remain unchanged.

```text
frontend/
  src/
    main.jsx                 # React entry point
    App.jsx                  # AppShell entry
    api.js                   # HTTP client and token helper
    style.css                # Existing responsive theme
    components/
      layout/
        AppShell.jsx         # Sidebar, topbar, role-based navigation, session handling
    pages/
      AuthPage.jsx           # Sign in and account registration
      DashboardPage.jsx      # Overview route
      VehiclesPage.jsx       # Vehicle registration and approval
      PermitsPage.jsx        # Applications, approvals, digital QR
      SlotsPage.jsx          # Slot and parking area CRUD / live availability
      GatePage.jsx           # Security QR scan, verify, entry, exit
      VisitsPage.jsx         # Visit history and CSV export
      UsersPage.jsx          # Account and role management
      ReportsPage.jsx        # Charts and report export
      SettingsPage.jsx       # Settings and audit log
    sections/
      DashboardOverview.jsx  # Dashboard fetching, charts, and actions
      DashboardMetricCards.jsx # Reusable summary metric grid
    ui/
      Status.jsx             # Colored status label
      Empty.jsx              # Empty table and list state
      Spinner.jsx            # Loading state
      Modal.jsx              # Dialog
      Field.jsx              # Input label wrapper
      FormButtons.jsx        # Form submit/cancel footer
      PageHead.jsx           # Page title, description, actions
      SearchBox.jsx          # Table search input
      Toast.jsx              # Success / error notifications
      index.js               # UI component barrel exports
    hooks/
      useData.js             # API collection fetch and reload
      useNotification.js     # Auto-dismissing success/error toast
    lib/
      utils.js               # Roles, formatters, filters, CSV export
```

To add a new page, create a component in `pages/`, import it into `components/layout/AppShell.jsx`, and add it to the permitted role menu and corresponding page switch. Reusable controls should go in `ui/`; reusable feature panels go in `sections/`. Keep the backend PHP API and SQL schema under `backend/` and `database/` respectively.

## Login troubleshooting (updated)
1. From XAMPP, start Apache and MySQL.
2. Visit `http://localhost/campus_parking/backend/api.php?route=health`. A healthy setup returns JSON with `"ok":true`, `"database":"connected"`, and `"accounts_seeded":true`.
3. If you see `404`, put the extracted **campus_parking** folder directly in `C:\xampp\htdocs\` (not nested twice), or update the `frontend/vite.config.js` proxy rewrite if using a different folder name.
4. If database tables are missing, import `database/campus_parking.sql` via phpMyAdmin.
5. In PowerShell from `C:\xampp\htdocs\campus_parking`, run `C:\xampp\php\php.exe backend\seed.php` and confirm `Created ...` or `Exists ...` messages.
6. If demo accounts already exist but passwords differ, run `C:\xampp\php\php.exe backend\seed.php --reset-demo-passwords` **only on a local test installation**.
7. Restart Vite (`npm run dev`) and use `admin@campus.test` / `Admin123!`.
8. If Apache runs on port 8080 rather than 80, change the Vite proxy target in `frontend/vite.config.js` to `http://localhost:8080` and open the health URL with `:8080`.


## Troubleshooting login 401 Unauthorized

`POST http://localhost:5173/api/api.php?route=login` is an expected development URL: Vite proxies `/api` to `http://localhost/campus_parking/backend`. A 401 means the PHP route responded, but rejected the credentials or disabled account. It is **not** a Vite proxy 404.

1. Start Apache and MySQL in XAMPP. Open `http://localhost/campus_parking/backend/api.php?route=health`. It should say `database: connected`, `accounts_seeded: true`.
2. In phpMyAdmin, import `database/campus_parking.sql` into the correct MySQL server. Check `backend/config.php` matches the database credentials.
3. Run `C:\xampp\php\php.exe C:\xampp\htdocs\campus_parking\backend\seed.php` in PowerShell. If the demo accounts already existed with mismatched passwords, use `C:\xampp\php\php.exe C:\xampp\htdocs\campus_parking\backend\seed.php --reset-demo-passwords` **only in local development**.
4. Restart Vite after changing `vite.config.js`, and sign in with `admin@campus.test` / `Admin123!`. Credentials are case-sensitive.
5. If the login URL returns 404 instead, verify the project folder is exactly `C:\xampp\htdocs\campus_parking` and check Vite proxy paths.

The login screen now displays basic backend/account setup status. The app also supplies its own favicon to avoid a missing `/favicon.ico` request.

## QR scanner, secure QR API and 6-month permits (updated)

- **Permits are valid for 6 calendar months** starting on the administrator's approval date, using MySQL `DATE_ADD(CURDATE(), INTERVAL 6 MONTH)` (e.g., 2026-11-19 through 2027-05-19). The previously configurable 180-day setting is no longer used for new approvals. Existing permits retain their original expiration date unless an administrator reissues them through a deliberate process.
- **`GET /api.php?route=permits/qr&id=PERMIT_ID`** is a real authenticated PHP endpoint that retrieves the server-issued QR payload for an approved, unexpired, verified vehicle; only its owner or an administrator can access it. The general permits listing no longer exposes the QR secret. The browser displays the returned payload with `qrcode.react` (works immediately, no extra PHP packages).
- **Optional server-rendered QR SVG API**: `GET /api.php?route=permits/qr-image&id=PERMIT_ID`. Install the independent server-side QR image package from `backend/composer.json` to enable this endpoint. In PowerShell, from `C:\xampp\htdocs\campus_parking\backend`, run `composer install` (requires Composer on your PC and internet to download the package). This endpoint generates SVG **on your own PHP server**, without sending confidential permit QR tokens to third-party QR websites. Without Composer, the React QR code still works via the secure JSON API above.
- QR format is `CPM|PERMIT_CODE|SECRET` generated with `random_bytes()` when approved. The guard scanner submits the scanned payload to `POST gate/verify`; `POST gate/record` revalidates it before performing transactional entry/exit changes. No third-party API knows the QR secret.
- **Gate camera troubleshooting**: Open `http://localhost:5173` (not `http://192.168.x.x:5173`) on the computer with a camera, or serve it over HTTPS for other devices. Click *Open camera scanner*, permit browser camera access, select the rear/front camera if multiple cameras are present. Close Teams/Zoom if the camera is busy. For desktop testing without a camera, select a QR image file or paste the QR text from the permit.

### Testing workflow
1. Sign in as student; register vehicle.
2. Sign in as admin; verify vehicle.
3. Student requests permit; admin approves (six-month expiry is stored).
4. Student opens their QR; QR data is fetched from authenticated PHP API.
5. Guard scans QR, chooses compatible available slot, records entry; scans again to record exit.
6. Verify occupied/available slot counts update.


## SorSU–Bulan Campus Park: official branding & QR gate upgrade

**Login and register panel:** The original user-supplied seal has been placed at `frontend/public/sorsu-seal.png` with a transparent circular crop. Both authentication modes share a deep maroon left panel and rotating pink brushstroke around the seal, inspired by the supplied screen recording. The animation honors the operating system's reduced-motion setting. The product name is **SorSU–Bulan Campus Park**.

**QR entry and exit:** Existing gate verification and transactional session logic are preserved. Guards can scan by camera or QR image, verify permit, assign a compatible vacant slot for entry, and scan the same permit on departure to release that slot. The gate page now shows success feedback, a Scan next vehicle action, and the latest eight entry/exit events (fetched from `visits` every 12 seconds). Optional clear PHP entry points `POST gate/entry` and `POST gate/exit` were added, preserving the existing `POST gate/record` route for compatibility. API actions continue enforcing role checks and expiry server-side. The existing QR token prefix `CPM|` is preserved so already-issued permits remain usable.

**Camera requirements:** A camera requires browser permission and `localhost` or HTTPS. A network IP on HTTP cannot access the camera in most browsers.

**Test end-to-end:** Sign in as student → register vehicle → admin verifies vehicle → student requests permit → admin approves → student displays QR → guard scans and assigns slot → verify occupancy → guard scans again and records exit → confirm slot is available and activity records show both events.

## ADMS database upgrade + mobile/iPad layouts

See **`ADMS_SETUP.md`** for a safe database migration, database-object descriptions, event scheduler configuration, SQL demo queries and responsive-device behavior. For existing installations, import **`database/ADMS_advanced_features.sql`** into phpMyAdmin **before** starting the upgraded PHP backend. Back up your database first. Do not re-import the original schema over your populated database.

## Security upgrade: dynamic single-use QR + express gate

**Existing installation**: Back up MySQL, then import `database/QR_SECURITY_UPGRADE.sql`
**after** the existing `database/ADMS_advanced_features.sql` migration. Do not delete your
existing database or re-import the original schema. The new migration adds `qr_access_tokens`
and `gate_scan_attempts` without changing historic visits or existing permit records.

Use the new frontend and backend together. The old static QR format (`CPM|...`) is deliberately
rejected. Signed-in permit holders open **My Permits → Live QR**; the server supplies a fresh
60-second random token every 40 seconds while the modal is visible. A previously issued
unused token is invalidated by the next refresh. A QR is marked used **only after** a successful
entry/exit transaction. The six-calendar-month *permit* duration is unchanged.

For gate security staff:

1. Open Gate Scanner, select **Start continuous scanning** and permit camera access on localhost or HTTPS.
2. Scan the current `CPD|...` QR, not an old screenshot or downloaded static code.
3. Compare the actual license plate with the registered plate, **type the physical plate**, and confirm.
4. For entry, the backend chooses the first compatible, unoccupied active slot automatically.
5. For exit, it closes the vehicle's active visit and frees its slot. The scanner restarts after confirmation.
6. If token expires or becomes invalid before the guard confirms, rescan the newly refreshed QR.

**Important:** A stolen live QR can still be used by someone within its short validity window,
so plate/vehicle identity checks and vigilant guards remain mandatory. This update does not
include automatic license plate recognition or vehicle barrier hardware. If the internet or
local database is unavailable, the guard must follow a controlled manual campus policy, not
automatically accept a QR. Provide backup/restore, TLS, strict account management, rate
limits, and monitoring before using the system at an operating campus gate.

The `health` API now includes `dynamic_qr_installed` so you can confirm the migration was
imported. SQL scheduled event cleanup is optional for token *security*; the backend rejects
expired/used codes even when the MySQL event scheduler is disabled. Test the full scenario
with XAMPP locally before deployment. A failed scan does not consume a valid token.

## Capstone upgrade: gate analytics, reconciliation & smart allocation

See **`CAPSTONE_FEATURES_SETUP.md`** for the new routes, administrator and guard screens, data model, installation, test cases, and limitations. After importing your existing ADMS and QR-security migrations, import **`database/CAPSTONE_OPERATIONS_UPGRADE.sql`** into your current database. Do **not** drop your existing database or reimport the base schema.

New pages: **Queue analytics** (guard/admin), **Occupancy inspection** (guard/admin), **Slot allocation** (admin/guard evaluation; student/faculty preferred area).

Unit scoring test: `C:\xampp\php\php.exe tests\test_allocation.php`.
