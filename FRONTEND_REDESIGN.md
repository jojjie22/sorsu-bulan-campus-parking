# CampusPark Frontend — Maroon Redesign

This update redesigns the *existing* React + Vite frontend. It does not replace the PHP REST API, database schema, account roles, QR protocol, permit validity rules, or parking transactions.

## Design direction

- **Maroon as a functional accent, not a decorative gradient:** a deep-maroon navigation rail (`#3e1422`), maroon actions (`#802f45`), near-white workspace (`#f8f7f6`), charcoal text, restrained success/warning indicators.
- **Hierarchy:** page title and context first; compact KPIs, data panels, and task shortcuts after. Controls retain descriptive text and predictable placement.
- **Professional UI:** flatter surfaces, subtle borders, limited radius/shadows, small overlines, consistent spacing, and accessible focus indication.
- **Responsive layout:** navigation becomes a drawer on narrow viewports, tables scroll horizontally, metrics adapt from five columns down to two, and forms become single-column.
- **Accessibility:** button labels, `aria-current` for active navigation, visible form labels, errors using `role="alert"`, and reduced-motion preference support.

## Organization

```text
frontend/src/
  App.jsx
  api.js                         HTTP client; central URL and authentication headers
  style.css                      Tokens, layouts, component styling and responsive rules
  components/layout/
    AppShell.jsx                 Composes authenticated application, pages, notifications
    Sidebar.jsx                  Shared role-aware desktop/mobile navigation
    Topbar.jsx                   Context, date, signed-in account
    navigation.js                Menu definition by role; PHP remains source of authorization
  components/gate/CameraScanner.jsx  Existing live scanner and fallback functionality
  hooks/
    useAuthSession.js            Login session lifecycle and expiry
    useData.js                   Reusable API collection loader
    useNotification.js           Shared notification lifecycle
  sections/
    DashboardOverview.jsx        Live summary, occupancy chart, actions
    DashboardMetricCards.jsx     Reusable KPI grid
  ui/
    Empty.jsx, Field.jsx, FormButtons.jsx, Modal.jsx,
    PageHead.jsx, SearchBox.jsx, Spinner.jsx, Status.jsx, Toast.jsx
  pages/
    AuthPage.jsx, DashboardPage.jsx, VehiclesPage.jsx,
    PermitsPage.jsx, SlotsPage.jsx, GatePage.jsx,
    VisitsPage.jsx, UsersPage.jsx, ReportsPage.jsx, SettingsPage.jsx
  lib/utils.js
```

## Maintainability decisions

1. **Single owners:** session lifecycle belongs to `useAuthSession`, API/authorization headers to `api.js`, navigation to `navigation.js`, and design values to `style.css`.
2. **UI primitives:** shared status badges, form fields, dialog, page header, and empty/error states avoid duplicated styling.
3. **Composition:** the app shell selects a page from a fixed registry; the page owns its feature-specific interactions, and sections own dashboard display.
4. **Purposeful comments:** comments document security boundaries, lifecycle or non-obvious choices rather than repeating JSX.
5. **Stable backend:** PHP authorization is authoritative. Navigation visibility alone is not access control.

## Windows / XAMPP setup

1. Extract the archive into `C:\xampp\htdocs\campus_parking`.
2. Keep/import `database/campus_parking.sql` if setting up a new database. **Do not reimport if you are preserving existing production or demo data.**
3. Start Apache and MySQL in XAMPP.
4. Check `http://localhost/campus_parking/backend/api.php?route=health`.
5. In PowerShell, run:

```powershell
cd C:\xampp\htdocs\campus_parking\frontend
npm install
npm run dev
```

Then open Vite's printed URL (often `http://localhost:5173`). The development proxy expects `C:\xampp\htdocs\campus_parking` and Apache on `http://localhost`; update `vite.config.js` if necessary.

The project archive intentionally omits `frontend/node_modules` (OS-specific compiled modules are not portable). `backend/vendor` remains included for the existing PHP QR rendering dependency.

## Verification and limitations

- Verified: local JSX/JavaScript parsing for 34 files, relative module import targets, PHP syntax, and project structure.
- A full Vite bundle cannot be verified in this build environment: the user's uploaded `node_modules` is missing Rollup's Linux native optional dependency and the package registry is not reachable offline. Run `npm install` on Windows to restore platform-specific packages, then `npm run build`.
- Live browser sign-in, scanning a camera, and XAMPP/MySQL transactional tests still need checking in your environment.
