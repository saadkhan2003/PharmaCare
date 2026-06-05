# Phase 5: Reports, Backup & Administration - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 completes the application with three major areas: (1) full owner analytics with PDF report export via @react-pdf/renderer, (2) Google Drive OAuth backup/restore with scheduled auto-backup and local-folder fallback, and (3) remaining settings UI screens (pharmacy info, financial config, backup config, user management).

Depends on Phase 3 (sales data) and Phase 4 (return correction data for accurate financials).

This is the final phase — after this the app is feature-complete for v1.

</domain>

<decisions>
## Implementation Decisions

### Carried Forward
- **D-01**: rusqlite in Rust Tauri commands — established.
- **D-07**: Sidebar — add Reports, Settings nav items (owner only).
- **D-08**: English UI only.
- **D-15**: Purchase prices/profit hidden from pharmacist at DTO layer.
- **D-26/27**: Settings backend reads exist (Phase 2) — now add the UI screens.
- **D-34**: Immutable sale snapshots — reports use historical data, not live prices.
- **D-55/56**: Returns are append-only corrections. Reports subtract refunds from revenue.

### Reports
- **D-57**: Reports are read-only aggregations over sale_items, returns, batches, purchases. All data is pre-existing in the database — no new data models needed.
- **D-58**: Each report is a Rust service function that returns a typed DTO. Frontend renders as table + Recharts chart + PDF export.
- **D-59**: PDF export uses @react-pdf/renderer (client-side, no server). Report data fetched via Tauri command, then rendered to PDF in the React layer.
- **D-60**: Reports are date-range filterable. Default range: last 30 days. All use UTC dates from the database.
- **D-61**: Profit calculations: `SUM(line_total) - SUM(purchase_cost * quantity)` per sale item. Refunds subtracted from revenue. Write-offs tracked as separate loss column.
- **D-62**: Top sellers by quantity and revenue. Slow-moving = items with zero sales in the selected date range.
- **D-63**: Reports viewable only by Owner role. Blocked at the command layer.

### Backup & Recovery
- **D-64**: Google Drive backup uses OAuth 2.0 via a background Rust thread. Token stored in a settings key (Google tokens are JSON). Backup triggered by a Tauri command, not a cron job (desktop app).
- **D-65**: Auto-backup scheduling: when the app is open at the configured time (default 11 PM), trigger backup. If app is closed, backup runs on next launch if the scheduled time has passed.
- **D-66**: Backup uses `VACUUM INTO 'path'` for a consistent snapshot — copies the live database atomically without needing the Backup API. Simpler than Online Backup API for a single-user desktop app.
- **D-67**: Uploaded to Google Drive via a simple HTTP multipart upload. Files named `pharmaCare_backup_YYYY-MM-DD.db.gz`. Gzip-compressed before upload.
- **D-68**: Restore: owner selects a backup → app creates a pre-restore backup → downloads from Drive → decompresses → replaces the database → restarts the app.
- **D-69**: Local folder backup: configurable path (USB drive). Same `VACUUM INTO` + gzip, just copy to local path instead of uploading.
- **D-70**: Backup status stored in settings: `last_backup_time`, `last_backup_status`. Dashboard reads these for the backup status widget.
- **D-71**: Missed backup detection: if `last_backup_time` is more than 3 days ago, show warning on dashboard.

### Settings UI
- **D-72**: Settings UI is a single page with tabbed sections: Pharmacy Info, Financial, Inventory, Backup.
- **D-73**: Settings values stored in the existing `settings` key-value table. Read/write through settings_service (commands already exist for reads — add write commands).
- **D-74**: Pharmacy Info: name, owner name, phone, address, logo path.
- **D-75**: Financial: default tax rate (%), tax enabled toggle, cashier discount toggle, currency symbol.
- **D-76**: Inventory: default reorder level, expiry warning threshold (days), expiry critical threshold (days).
- **D-77**: Backup: Google Drive connect/disconnect, auto-backup time, local folder path, manual backup now, manual restore.

### User Management (already partially built)
- **D-78**: User management screen already exists (Phase 1) — verify it's complete and connected. Add password change functionality for the current user.

### the agent's Discretion
- Report PDF layout and design
- Settings page tab layout
- Google Drive OAuth token exchange details
- Backup status dashboard widget design
- Specific Recharts chart types for each report

</decisions>

<canonical_refs>
## Canonical References

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — REPT-03 through REPT-13, BAKP-01 through BAKP-09, SETT-07, SETT-08
- `.planning/ROADMAP.md` §"Phase 5: Reports, Backup & Administration" — 7 success criteria
- `PRD.md` §5.7 (Analytics & Reports) — Report specs
- `PRD.md` §5.9 (Data Backup & Recovery) — Backup/restore flow
- `PRD.md` §5.10 (Settings) — Settings sections

### Research
- `.planning/research/SUMMARY.md` — Report aggregation from immutable facts, backup using VACUUM INTO
- `.planning/research/PITFALLS.md` — Pitfalls 4 (reports from immutable data), 7 (WAL-safe backup), 8 (safe restore)

### Existing Code
- `src-tauri/src/services/` — Report aggregation services to create
- `src-tauri/src/repository/settings_repo.rs` — Settings read/write
- `src/pages/SettingsPage.tsx` — To create (use placeholder if exists)
- `src/pages/UsersPage.tsx` — Already exists from Phase 1
- `src/components/layout/Sidebar.tsx` — Add Reports, Settings nav
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Recharts**: Already installed (Phase 3 dashboard) — use for report charts
- **@react-pdf/renderer**: Declared in tech stack but not yet installed — needs npm install
- **Settings service**: Read commands exist (get_settings) — add write commands
- **Dashboard page**: Owner dashboard has today's KPIs — extend with report navigation
- **Sidebar**: Add Reports and Settings items

### Established Patterns
- **Three-layer Rust**: Repository → Service → Command
- **Role-masked DTOs**: Owner-only reports blocked at command layer
- **Atomic transactions**: Backup operations use VACUUM INTO

### Integration Points
- Add report commands to main.rs
- Add settings write commands to settings_commands.rs
- Add sidebar items for Reports, Settings
- Add routes in App.tsx
- Add Settings nav item and page
</code_context>

<specifics>
## Specific Ideas

- Reports page shows a list of available report types, clicking one opens the filtered view with date range picker and PDF export button
- Backup settings page shows connection status, last backup time, and manual trigger buttons
- Settings follows the tabbed layout pattern common in desktop apps
- Google Drive OAuth uses a Tauri command that opens a browser for auth, captures the redirect, and stores the token

</specifics>

<deferred>
## Deferred Ideas

- None — this is the final phase for v1
</deferred>

---

*Phase: 5-Reports, Backup & Administration*
*Context gathered: 2026-06-05*
