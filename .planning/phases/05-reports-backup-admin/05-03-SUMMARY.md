---
phase: 05-reports-backup-admin
plan: 03
subsystem: frontend-admin
tags: [settings-ui, backup-widget, password-change, sidebar-navigation, routing]
requires: [05-01, 05-02]
provides: [admin-settings, backup-widget, password-change]
affects: [frontend-routing, dashboard]
tech-stack:
  added: []
  patterns:
    - Tabbed settings: state-driven tab buttons with conditional tab panel rendering
    - Backup OAuth: connectDrive opens browser URL → poll get_backup_status every 2s until connected
    - ToggleSwitch: inline button-based switch component (no dependency needed)
    - Inline notifications: state-based success/error messages (no toast library)
    - Password change: Dialog with current + new password, client-side validation before backend call
key-files:
  created:
    - src/pages/SettingsPage.tsx (tabbed settings container, 4 tabs)
    - src/components/settings/PharmacyInfoTab.tsx (name, owner, phone, address, logo)
    - src/components/settings/FinancialTab.tsx (tax rate, tax toggle, discount toggle, currency)
    - src/components/settings/InventoryTab.tsx (reorder level, expiry warning, expiry critical)
    - src/components/settings/BackupTab.tsx (Drive OAuth, backup/restore, auto-backup time, local path)
    - src/components/users/ChangePasswordDialog.tsx (current/new password, validation)
  modified:
    - src/hooks/useSettings.ts (added refresh function with refreshKey state)
    - src/pages/UsersPage.tsx (added Change Password button alongside Add User)
    - src/components/layout/Sidebar.tsx (added Reports, Settings nav items with icons)
    - src/App.tsx (added Route path='/settings' in owner block)
    - src/pages/DashboardPage.tsx (added backup status widget + missed-backup warning)
decisions:
  - "Settings uses custom button-based tabs (no radix/base-ui tabs dependency needed)"
  - "ToggleSwitch uses a simple button+span with aria-role switch (no switch dependency)"
  - "Backup OAuth uses polling approach: open URL → poll get_backup_status every 2s for 60s max"
  - "Backup restore picks the most recent Drive backup, shows confirmation dialog before proceeding"
  - "Missed-backup threshold is 72 hours (3 days) per D-71"
  - "Dashboard backup widget is read-only — backup triggers handled in Settings page"
  - "SessionDto uses token field (not session_token) — matched existing pattern"
metrics:
  duration: "~25 minutes"
  completed_date: "2026-06-05"
---

# Phase 5 Plan 3: Settings UI, Backup Widget, Password Change

**One-liner:** Tabbed settings page (Pharmacy Info, Financial, Inventory, Backup tabs) with Google Drive OAuth, manual backup/restore, password change dialog, backup status widget on dashboard, and sidebar navigation for Reports/Settings.

## Summary

This plan completes the final v1 admin interface with four self-contained commits:

### Task 1: Tabbed Settings Page (6 files)
- `useSettings.ts`: extended with `refresh` function using `refreshKey` state to re-fetch after saves
- `SettingsPage.tsx`: header + 4-tab navigation with `aria-selected`/`role=tablist` accessibility
- `PharmacyInfoTab.tsx`: pharmacy name, owner name, phone, address, logo path — all text inputs pre-filled from settings
- `FinancialTab.tsx`: tax rate (number), tax toggle (custom switch), discount toggle, currency symbol
- `InventoryTab.tsx`: reorder level, expiry warning days, expiry critical days — with helper text explaining each threshold
- `BackupTab.tsx`: full backup management UI
  - Google Drive section: shows connected/disconnected state, client ID/secret form, OAuth connect flow with browser URL + 2s polling (60s timeout)
  - Auto-backup time (type="time", default 23:00) + local folder path with save
  - Manual Backup Now (calls trigger_backup) + Restore (lists Drive backups, picks latest, shows confirmation)
  - Status display: last backup time, status color, 3-day missed warning

### Task 2: Password Change + Sidebar + Routing (4 files)
- `ChangePasswordDialog.tsx`: modal dialog with current/new/confirm password fields, client-side validation (min 6 chars, match), error display, success state
- `UsersPage.tsx`: added Change Password button alongside Add User in a flex row
- `Sidebar.tsx`: added Reports (BarChart3 icon) and Settings (Settings icon) nav items after Expiry Report, owner-only role
- `App.tsx`: added `Route path="/settings"` in owner block

### Task 3: Dashboard Backup Widget (1 file)
- `DashboardPage.tsx`: added `useTauriCommand<BackupStatus>` to fetch backup status on mount (owner only)
- Backup widget card: shows Drive connection state (Cloud/CloudOff icon), last backup time, last status
- Missed-backup warning banner (amber, clickable → `/settings`): shown when `last_backup_time` is null or >72 hours ago

## Build Verification

- `npx tsc --noEmit` — passes (0 errors)
- `npm run build` — passes (2760 modules, 12.56s)
- `cargo check` (src-tauri) — passes

## Commit History

| Commit | Hash | Description |
|--------|------|-------------|
| Task 1 | 35af2fa | Tabbed Settings page with 4 settings tab components |
| Task 2 | 9c31c70 | Password change dialog, sidebar nav items, settings route |
| Task 3 | 65276cb | Backup status widget and missed-backup warning on dashboard |

## Deviations from Plan

None — plan executed exactly as written.

## Success Criteria

- [x] Tabbed Settings page: Pharmacy Info, Financial, Inventory, Backup tabs — all pre-filled and savable
- [x] Backup tab: Google Drive OAuth connect/disconnect, Backup Now, Restore, auto-backup time, local folder path
- [x] ChangePasswordDialog in UsersPage: current + new password with validation
- [x] Dashboard backup widget: Drive connection state + last backup time + status
- [x] Missed-backup warning banner on dashboard when backup >3 days overdue
- [x] Sidebar nav items for Reports (BarChart3) and Settings (Settings icon) — owner only
- [x] Routes for /reports (existing) and /settings (new) registered
- [x] All TypeScript compiles without errors
- [x] npm run build passes
- [x] cargo check passes

## Self-Check: PASSED

All 11 source files verified present. All 3 commit hashes confirmed in git log. `npx tsc --noEmit` passes with 0 errors. `npm run build` output confirms 2760 modules transformed. `cargo check` passes.
